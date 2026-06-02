"""管理后台路由。所有接口需管理员(require_admin)。"""
import json

from flask import Blueprint, request

from errors import (
    ok, fail,
    ERR_PARAM, ERR_BUSINESS, ERR_CARD_NOT_FOUND, ERR_GAME_NOT_FOUND,
)
from extensions import db
from models import User, Card, SpecialCard, Game, GameScore, AppSetting
from auth.decorators import require_admin
from cards.service import card_detail, special_detail

admin_bp = Blueprint("admin", __name__)

# 可被管理员编辑的校友牌字段(card_key 由 suit+rank 派生,不直接改)
CARD_FIELDS = [
    "suit", "rank", "alumni_name", "graduation_year", "college", "major",
    "company_name", "position", "industry", "business_desc", "avatar_url",
    "card_image_url", "contact_phone", "wechat", "email", "company_address",
    "founded_year", "team_size", "latest_news", "alumni_quote", "is_published",
]
SPECIAL_FIELDS = [
    "title", "subtitle", "logo_url", "card_image_url", "motto", "description",
    "contact_phone", "contact_email", "address", "website_url",
]
ALLOWED_SUITS = {"hearts", "spades", "clubs", "diamonds"}
ALLOWED_RANKS = {"A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"}
CARD_INT_FIELDS = {"graduation_year", "founded_year"}


def _parse_bool(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _page_args():
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except ValueError:
        page = 1
    try:
        size = min(max(int(request.args.get("size", 20)), 1), 100)
    except ValueError:
        size = 20
    return page, size


# ---------- 图片上传 ----------

@admin_bp.post("/upload")
@require_admin
def upload_image():
    """上传扑克牌图片,返回可访问 URL。表单字段名 file。"""
    from common.uploads import save_image
    try:
        return ok({"url": save_image(request.files.get("file"))})
    except ValueError as e:
        return fail(ERR_PARAM, str(e))


# ---------- 全局设置(统一背面图等) ----------

def _get_setting(key, default=None):
    row = AppSetting.query.get(key)
    return row.value if row else default


@admin_bp.get("/settings")
@require_admin
def get_settings():
    return ok({"card_back_url": _get_setting("card_back_url")})


@admin_bp.put("/settings")
@require_admin
def put_settings():
    body = request.get_json(silent=True) or {}
    for key in ("card_back_url",):
        if key in body:
            row = AppSetting.query.get(key)
            if row is None:
                row = AppSetting(key=key, value=body[key])
                db.session.add(row)
            else:
                row.value = body[key]
    db.session.commit()
    return ok({"card_back_url": _get_setting("card_back_url")})


# ---------- 概览 ----------

@admin_bp.get("/stats")
@require_admin
def stats():
    return ok({
        "users": User.query.count(),
        "admins": User.query.filter_by(role="admin").count(),
        "cards": Card.query.count(),
        "cards_published": Card.query.filter_by(is_published=True).count(),
        "special_cards": SpecialCard.query.count(),
        "games": Game.query.count(),
        "games_enabled": Game.query.filter_by(is_enabled=True).count(),
        "game_plays": GameScore.query.count(),
    })


# ---------- 用户管理 ----------

@admin_bp.get("/users")
@require_admin
def list_users():
    q = (request.args.get("q") or "").strip()
    status = (request.args.get("status") or "").strip()
    page, size = _page_args()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            User.phone.like(like) | User.nickname.like(like) | User.real_name.like(like)
        )
    if status in ("pending", "approved", "rejected"):
        query = query.filter(User.status == status)
    total = query.count()
    rows = (
        query.order_by(User.id.desc())
        .offset((page - 1) * size).limit(size).all()
    )
    # 一次查出关联校友牌信息(疑似校友提示),避免 N+1
    card_ids = [u.card_id for u in rows if u.card_id]
    cmap = {}
    if card_ids:
        for c in Card.query.filter(Card.id.in_(card_ids)).all():
            cmap[c.id] = {"card_key": c.card_key, "alumni_name": c.alumni_name}
    return ok({
        "total": total, "page": page, "size": size,
        "items": [{
            "id": u.id, "phone": u.phone, "nickname": u.nickname,
            "role": u.role, "status": u.status, "points": u.points, "card_id": u.card_id,
            "alumni_card": cmap.get(u.card_id),
            "real_name": u.real_name, "grade": u.grade, "major": u.reg_major,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        } for u in rows],
    })


@admin_bp.get("/users/<int:uid>")
@require_admin
def user_detail(uid):
    u = User.query.get(uid)
    if u is None:
        return fail(ERR_PARAM, "用户不存在")
    plays = GameScore.query.filter_by(user_id=u.id).count()
    return ok({
        "id": u.id, "phone": u.phone, "nickname": u.nickname,
        "role": u.role, "points": u.points, "game_plays": plays,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    })


@admin_bp.post("/users/<int:uid>/points")
@require_admin
def adjust_points(uid):
    u = User.query.get(uid)
    if u is None:
        return fail(ERR_PARAM, "用户不存在")
    body = request.get_json(silent=True) or {}
    if "set" in body:
        try:
            new_val = max(int(body["set"]), 0)
        except (ValueError, TypeError):
            return fail(ERR_PARAM, "set 必须为整数")
        u.points = new_val
    elif "delta" in body:
        try:
            u.points = max((u.points or 0) + int(body["delta"]), 0)
        except (ValueError, TypeError):
            return fail(ERR_PARAM, "delta 必须为整数")
    else:
        return fail(ERR_PARAM, "需提供 set 或 delta")
    db.session.commit()
    return ok({"id": u.id, "points": u.points})


@admin_bp.post("/users/<int:uid>/status")
@require_admin
def set_user_status(uid):
    """审核注册用户:approved(通过)/ rejected(拒绝)/ pending(打回待审)。"""
    u = User.query.get(uid)
    if u is None:
        return fail(ERR_PARAM, "用户不存在")
    if u.role == "admin":
        return fail(ERR_PARAM, "管理员账号无需审核,无法变更其状态")
    body = request.get_json(silent=True) or {}
    st = (body.get("status") or "").strip()
    if st not in ("pending", "approved", "rejected"):
        return fail(ERR_PARAM, "status 仅支持 pending/approved/rejected")
    u.status = st
    # 拒绝/打回待审即时吊销其登录态:自增 token_version 使现有 token 失效
    if st in ("rejected", "pending"):
        u.token_version = (u.token_version or 0) + 1
    db.session.commit()
    return ok({"id": u.id, "status": u.status})


@admin_bp.post("/users/<int:uid>/link-card")
@require_admin
def link_user_card(uid):
    """手动关联/解除用户与校友牌(给缺电话、自动匹配不到的校友补关联)。

    body: { "card_key": "spades_A" } 关联;{ "card_key": "" } 或缺省则解除。
    """
    u = User.query.get(uid)
    if u is None:
        return fail(ERR_PARAM, "用户不存在")
    body = request.get_json(silent=True) or {}
    key = (body.get("card_key") or "").strip()
    if not key:
        u.card_id = None
        db.session.commit()
        return ok({"id": u.id, "card_id": None})
    card = Card.query.filter_by(card_key=key).first()
    if card is None:
        return fail(ERR_CARD_NOT_FOUND, "校友牌不存在(card_key 如 spades_A)")
    u.card_id = card.id
    db.session.commit()
    return ok({
        "id": u.id, "card_id": card.id,
        "card_key": card.card_key, "alumni_name": card.alumni_name,
    })


# ---------- 扑克牌管理 ----------

@admin_bp.get("/cards")
@require_admin
def admin_list_cards():
    page, size = _page_args()
    q = (request.args.get("q") or "").strip()
    query = Card.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            Card.alumni_name.like(like) | Card.company_name.like(like)
            | Card.card_key.like(like)
        )
    total = query.count()
    rows = query.order_by(Card.id.asc()).offset((page - 1) * size).limit(size).all()
    return ok({
        "total": total, "page": page, "size": size,
        "items": [card_detail(c, include_contact=True) for c in rows],
    })


@admin_bp.put("/cards/<int:cid>")
@require_admin
def edit_card(cid):
    c = Card.query.get(cid)
    if c is None:
        return fail(ERR_CARD_NOT_FOUND)
    body = request.get_json(silent=True) or {}

    new_suit = body.get("suit", c.suit)
    new_rank = body.get("rank", c.rank)
    if new_suit not in ALLOWED_SUITS:
        return fail(ERR_PARAM, "花色仅支持 hearts/spades/clubs/diamonds")
    if new_rank not in ALLOWED_RANKS:
        return fail(ERR_PARAM, "点数仅支持 A/2-10/J/Q/K")
    if new_suit != c.suit or new_rank != c.rank:
        new_key = f"{new_suit}_{new_rank}"
        clash = Card.query.filter(
            Card.card_key == new_key, Card.id != c.id
        ).first()
        if clash:
            return fail(ERR_BUSINESS, f"花色点数已被占用:{new_key}")
        c.card_key = new_key

    for f in CARD_FIELDS:
        if f not in body:
            continue
        v = body[f]
        if f in CARD_INT_FIELDS:
            if v in (None, ""):
                setattr(c, f, None)
            else:
                try:
                    setattr(c, f, int(v))
                except (ValueError, TypeError):
                    return fail(ERR_PARAM, f"{f} 必须为数字")
        elif f == "is_published":
            c.is_published = _parse_bool(v)
        else:
            setattr(c, f, v)
    db.session.commit()
    return ok(card_detail(c, include_contact=True))


# ---------- 特殊牌(大王/小王)管理 ----------

@admin_bp.get("/special-cards")
@require_admin
def admin_special():
    return ok({"items": [special_detail(s, include_contact=True) for s in SpecialCard.query.all()]})


@admin_bp.put("/special-cards/<stype>")
@require_admin
def edit_special(stype):
    s = SpecialCard.query.filter_by(type=stype).first()
    if s is None:
        return fail(ERR_PARAM, "特殊牌不存在(king/joker)")
    body = request.get_json(silent=True) or {}
    for f in SPECIAL_FIELDS:
        if f in body:
            setattr(s, f, body[f])
    # features / extra_data 以 JSON 存储
    for jf in ("features", "extra_data"):
        if jf in body:
            setattr(s, jf, json.dumps(body[jf], ensure_ascii=False))
    db.session.commit()
    return ok(special_detail(s, include_contact=True))


# ---------- 游戏管理(上下架) ----------

@admin_bp.get("/games")
@require_admin
def admin_games():
    rows = Game.query.order_by(Game.id.asc()).all()
    return ok({"items": [{
        "id": g.id, "game_id": g.game_id, "name": g.name,
        "version": g.version, "description": g.description,
        "is_enabled": g.is_enabled, "is_builtin": g.is_builtin,
    } for g in rows]})


@admin_bp.post("/games/<game_id>/toggle")
@require_admin
def toggle_game(game_id):
    g = Game.query.filter_by(game_id=game_id).first()
    if g is None:
        return fail(ERR_GAME_NOT_FOUND)
    body = request.get_json(silent=True) or {}
    g.is_enabled = bool(body["enabled"]) if "enabled" in body else not g.is_enabled
    db.session.commit()
    return ok({"game_id": g.game_id, "is_enabled": g.is_enabled})

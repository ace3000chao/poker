"""管理后台路由。所有接口需管理员(require_admin)。"""
import json

from flask import Blueprint, request

from errors import (
    ok, fail,
    ERR_PARAM, ERR_BUSINESS, ERR_CARD_NOT_FOUND, ERR_GAME_NOT_FOUND,
)
from extensions import db
from models import User, Card, SpecialCard, Game, GameScore
from auth.decorators import require_admin
from cards.service import card_detail, special_detail

admin_bp = Blueprint("admin", __name__)

# 可被管理员编辑的校友牌字段(card_key 由 suit+rank 派生,不直接改)
CARD_FIELDS = [
    "suit", "rank", "alumni_name", "graduation_year", "college", "major",
    "company_name", "position", "industry", "business_desc", "avatar_url",
    "contact_phone", "wechat", "email", "company_address", "founded_year",
    "team_size", "latest_news", "alumni_quote", "is_published",
]
SPECIAL_FIELDS = [
    "title", "subtitle", "logo_url", "motto", "description",
    "contact_phone", "contact_email", "address", "website_url",
]


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
    page, size = _page_args()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(User.phone.like(like) | User.nickname.like(like))
    total = query.count()
    rows = (
        query.order_by(User.id.desc())
        .offset((page - 1) * size).limit(size).all()
    )
    return ok({
        "total": total, "page": page, "size": size,
        "items": [{
            "id": u.id, "phone": u.phone, "nickname": u.nickname,
            "role": u.role, "points": u.points,
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
        "items": [card_detail(c) for c in rows],
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
    if new_suit != c.suit or new_rank != c.rank:
        new_key = f"{new_suit}_{new_rank}"
        clash = Card.query.filter(
            Card.card_key == new_key, Card.id != c.id
        ).first()
        if clash:
            return fail(ERR_BUSINESS, f"花色点数已被占用:{new_key}")
        c.card_key = new_key

    for f in CARD_FIELDS:
        if f in body:
            setattr(c, f, body[f])
    db.session.commit()
    return ok(card_detail(c))


# ---------- 特殊牌(大王/小王)管理 ----------

@admin_bp.get("/special-cards")
@require_admin
def admin_special():
    return ok({"items": [special_detail(s) for s in SpecialCard.query.all()]})


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
    return ok(special_detail(s))


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

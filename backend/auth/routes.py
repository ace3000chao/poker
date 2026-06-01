"""认证与用户信息路由。

  POST /api/auth/send-code   发送验证码
  POST /api/auth/login       手机号+验证码 登录/自动注册
  POST /api/auth/refresh     用 Refresh Token 换新 Access Token
  GET  /api/user/profile     获取当前用户信息(需登录)
"""
from flask import Blueprint, request, g

from errors import (
    ok, fail,
    ERR_PARAM, ERR_SMS_TOO_FREQUENT, ERR_ACCOUNT_LOCKED,
    ERR_CODE_WRONG, ERR_CODE_EXPIRED, ERR_CODE_USED, ERR_CODE_PURPOSE,
    ERR_REFRESH_INVALID,
    ERR_PASSWORD_WRONG, ERR_PASSWORD_WEAK, ERR_OLD_PASSWORD_WRONG,
    ERR_FORBIDDEN, ERR_CARD_NOT_FOUND,
)

# 校友本人可自助编辑的公开字段(不含姓名/花色点数/是否公开/正面图——归管理员)
ALUMNI_STR_FIELDS = [
    "college", "major", "company_name", "position", "industry",
    "business_desc", "alumni_quote", "latest_news",
    "contact_phone", "wechat", "email", "company_address", "team_size",
]
ALUMNI_INT_FIELDS = ["graduation_year", "founded_year"]
from extensions import db
from models import User
from utils.jwt_util import decode_token, issue_access_token
from . import service
from .decorators import require_auth

auth_bp = Blueprint("auth", __name__)
user_bp = Blueprint("user", __name__)


def _client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "")


@auth_bp.post("/send-code")
def send_code():
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    purpose = (body.get("purpose") or "login").strip()

    if not service.is_valid_phone(phone):
        return fail(ERR_PARAM, "手机号格式错误")
    if purpose not in ("login", "register", "reset_password"):
        return fail(ERR_CODE_PURPOSE, "仅支持 login/register/reset_password")

    allowed, retry_after = service.can_send_code(phone, purpose)
    if not allowed:
        return fail(ERR_SMS_TOO_FREQUENT, f"请 {retry_after} 秒后再试")

    expires_in = service.create_and_send_code(phone, purpose)
    return ok({"expires_in": expires_in, "next_can_send_in": 60})


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    code = (body.get("code") or "").strip()
    purpose = (body.get("purpose") or "login").strip()
    ip = _client_ip()

    if not service.is_valid_phone(phone) or not code:
        return fail(ERR_PARAM, "手机号或验证码格式错误")
    if purpose not in ("login", "register"):
        return fail(ERR_CODE_PURPOSE)

    # Q5:登录锁定独立判断
    if service.is_locked(phone):
        return fail(ERR_ACCOUNT_LOCKED)

    status, record = service.verify_code(phone, code, purpose)
    if status != service.CODE_OK:
        service.record_attempt(phone, success=False, ip=ip)
        return fail({
            service.CODE_NOT_FOUND: ERR_CODE_WRONG,
            service.CODE_WRONG: ERR_CODE_WRONG,
            service.CODE_EXPIRED: ERR_CODE_EXPIRED,
            service.CODE_USED: ERR_CODE_USED,
        }[status])

    # 验证码作废 + 记录成功(重置失败计数)
    record.is_used = True
    db.session.commit()
    service.record_attempt(phone, success=True, ip=ip)

    user = service.get_or_create_user(phone)
    tokens = service.issue_tokens(user)
    return ok({
        **tokens,
        "user": {
            "id": user.id,
            "phone": user.phone,
            "role": user.role,
            "status": user.status,
            "is_alumni": bool(user.card_id),
            "points": user.points,
            "nickname": user.nickname,
        },
    })


@auth_bp.post("/register")
def register():
    """自助注册:手机号 + 密码 + 真实姓名 + 年级 + 专业。

    新账号状态为 pending(待管理员审核);若手机号匹配某校友牌则自动通过(校友)。
    注册即登录(签发令牌),但待审核期间访问受限(详情/游戏需通过)。
    """
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    password = body.get("password") or ""
    real_name = (body.get("real_name") or "").strip()
    grade = (body.get("grade") or "").strip()
    reg_major = (body.get("major") or "").strip()

    if not service.is_valid_phone(phone):
        return fail(ERR_PARAM, "手机号格式错误")
    if not service.is_valid_password(password):
        return fail(ERR_PASSWORD_WEAK)
    if not real_name or not grade or not reg_major:
        return fail(ERR_PARAM, "请填写真实姓名、年级、专业")
    if User.query.filter_by(phone=phone).first():
        return fail(ERR_PARAM, "该手机号已注册,请直接登录")

    user = User(phone=phone, role="user", status="pending",
                real_name=real_name, grade=grade, reg_major=reg_major, points=0)
    user.set_password(password)
    db.session.add(user)
    service.maybe_link_alumni(user)   # 校友手机号 → 自动通过并关联
    db.session.commit()

    tokens = service.issue_tokens(user)
    return ok({
        **tokens,
        "user": {
            "id": user.id, "phone": user.phone, "role": user.role,
            "status": user.status, "is_alumni": bool(user.card_id),
        },
    })


@auth_bp.post("/login-password")
def login_password():
    """手机号 + 密码登录。失败按统一「密码错误」回应,不泄露账号是否存在。"""
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    password = body.get("password") or ""
    ip = _client_ip()

    if not service.is_valid_phone(phone) or not password:
        return fail(ERR_PARAM, "手机号或密码格式错误")

    # Q5:登录锁定独立判断(与验证码登录共用失败计数)
    if service.is_locked(phone):
        return fail(ERR_ACCOUNT_LOCKED)

    user = User.query.filter_by(phone=phone).first()
    if user is None or not user.check_password(password):
        service.record_attempt(phone, success=False, ip=ip)
        return fail(ERR_PASSWORD_WRONG)

    service.record_attempt(phone, success=True, ip=ip)
    tokens = service.issue_tokens(user)
    return ok({
        **tokens,
        "user": {
            "id": user.id,
            "phone": user.phone,
            "role": user.role,
            "status": user.status,
            "is_alumni": bool(user.card_id),
            "points": user.points,
            "nickname": user.nickname,
        },
    })


@auth_bp.post("/set-password")
@require_auth
def set_password():
    """登录态下设置 / 修改自己的密码。

    首次设置(尚无密码)无需原密码;已设置过则必须校验 old_password。
    """
    body = request.get_json(silent=True) or {}
    new_password = body.get("new_password") or ""
    old_password = body.get("old_password") or ""
    user = g.current_user

    if not service.is_valid_password(new_password):
        return fail(ERR_PASSWORD_WEAK)
    if user.has_password() and not user.check_password(old_password):
        return fail(ERR_OLD_PASSWORD_WRONG)

    user.set_password(new_password)
    db.session.commit()
    return ok({"has_password": True})


@auth_bp.post("/reset-password")
def reset_password():
    """凭 reset_password 验证码重置密码(忘记密码),成功后直接签发令牌。"""
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    code = (body.get("code") or "").strip()
    new_password = body.get("new_password") or ""
    ip = _client_ip()

    if not service.is_valid_phone(phone) or not code:
        return fail(ERR_PARAM, "手机号或验证码格式错误")
    if not service.is_valid_password(new_password):
        return fail(ERR_PASSWORD_WEAK)

    # 与登录共用失败计数/锁定,防止凭验证码暴力重置
    if service.is_locked(phone):
        return fail(ERR_ACCOUNT_LOCKED)

    status, record = service.verify_code(phone, code, "reset_password")
    if status != service.CODE_OK:
        service.record_attempt(phone, success=False, ip=ip)
        return fail({
            service.CODE_NOT_FOUND: ERR_CODE_WRONG,
            service.CODE_WRONG: ERR_CODE_WRONG,
            service.CODE_EXPIRED: ERR_CODE_EXPIRED,
            service.CODE_USED: ERR_CODE_USED,
        }[status])

    # 重置密码不得为未注册手机号建号;为避免账号枚举,统一回"验证码错误"
    user = User.query.filter_by(phone=phone).first()
    if user is None:
        service.record_attempt(phone, success=False, ip=ip)
        return fail(ERR_CODE_WRONG)

    record.is_used = True
    user.set_password(new_password)
    db.session.commit()
    service.record_attempt(phone, success=True, ip=ip)

    tokens = service.issue_tokens(user)
    return ok({
        **tokens,
        "user": {
            "id": user.id,
            "phone": user.phone,
            "role": user.role,
            "points": user.points,
            "nickname": user.nickname,
        },
    })


@auth_bp.post("/refresh")
def refresh():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
    if not token:
        return fail(ERR_REFRESH_INVALID)

    payload, err = decode_token(token, expected_type="refresh")
    if err is not None:
        return fail(ERR_REFRESH_INVALID)

    user = User.query.get(int(payload["sub"]))
    if user is None:
        return fail(ERR_REFRESH_INVALID)

    access = issue_access_token(user)
    from datetime import datetime
    from flask import current_app
    user.jwt_token = access
    user.jwt_expires_at = datetime.utcnow() + current_app.config["JWT_ACCESS_EXPIRES"]
    db.session.commit()
    return ok({
        "access_token": access,
        "expires_in": int(current_app.config["JWT_ACCESS_EXPIRES"].total_seconds()),
    })


@user_bp.get("/profile")
@require_auth
def profile():
    from models import Card

    u = g.current_user
    card = Card.query.get(u.card_id) if u.card_id else None
    # 前端展示用的四态角色:guest 由前端(未登录)判定,这里给 user/alumni/admin
    display_role = "admin" if u.role == "admin" else ("alumni" if card else "user")
    return ok({
        "id": u.id,
        "phone": u.phone,
        "nickname": u.nickname,
        "role": display_role,        # admin / alumni / user(前端展示)
        "authority": u.role,         # user / admin(权限)
        "status": u.status,          # pending / approved / rejected
        "real_name": u.real_name,
        "grade": u.grade,
        "major": u.reg_major,
        "avatar_url": u.avatar_url,
        "points": u.points,
        "is_alumni": bool(card),
        "alumni_card": (
            {"card_key": card.card_key, "alumni_name": card.alumni_name}
            if card else None
        ),
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    })


@user_bp.post("/avatar")
@require_auth
def upload_avatar():
    """登录用户上传个人头像。校友用户(已关联校友牌)的头像同步到其牌面。"""
    from common.uploads import save_image
    from models import Card

    try:
        url = save_image(request.files.get("file"))
    except ValueError as e:
        return fail(ERR_PARAM, str(e))

    u = g.current_user
    u.avatar_url = url
    if u.card_id:
        card = Card.query.get(u.card_id)
        if card:
            card.avatar_url = url   # 同步到校友牌,牌墙/详情同步更新
    db.session.commit()
    return ok({"avatar_url": url, "synced_to_card": bool(u.card_id)})


@user_bp.put("/card")
@require_auth
def update_my_card():
    """校友本人自助编辑自己牌的公开资料(白名单字段)。"""
    from models import Card
    from cards.service import card_detail

    u = g.current_user
    if not u.card_id:
        return fail(ERR_FORBIDDEN, "仅校友本人可编辑校友资料")
    card = Card.query.get(u.card_id)
    if card is None:
        return fail(ERR_CARD_NOT_FOUND)

    body = request.get_json(silent=True) or {}
    for f in ALUMNI_STR_FIELDS:
        if f in body:
            v = body[f]
            setattr(card, f, (v.strip() if isinstance(v, str) else v) or None)
    for f in ALUMNI_INT_FIELDS:
        if f in body:
            v = body[f]
            if v in (None, ""):
                setattr(card, f, None)
            else:
                try:
                    setattr(card, f, int(v))
                except (ValueError, TypeError):
                    return fail(ERR_PARAM, f"{f} 必须为数字")
    db.session.commit()
    return ok(card_detail(card, include_contact=True))

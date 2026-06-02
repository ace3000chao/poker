"""鉴权装饰器:require_auth / require_approved / require_admin。

从 Authorization: Bearer <access_token> 解析,校验后把 User 挂到 g.current_user。
错误码遵循全局唯一表(errors.py)。
"""
from functools import wraps

from flask import request, g

from errors import (
    fail, ERR_UNAUTHORIZED, ERR_TOKEN_EXPIRED, ERR_FORBIDDEN, ERR_ACCOUNT_PENDING,
)
from models import User
from utils.jwt_util import decode_token


def _extract_bearer():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[7:].strip()


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_bearer()
        if not token:
            return fail(ERR_UNAUTHORIZED)
        payload, err = decode_token(token, expected_type="access")
        if err == "expired":
            return fail(ERR_TOKEN_EXPIRED)
        if err is not None:
            return fail(ERR_UNAUTHORIZED)
        user = User.query.get(int(payload["sub"]))
        if user is None:
            return fail(ERR_UNAUTHORIZED)
        # 令牌版本比对:登出/封号后 token_version 自增,旧 token 即失效(已吊销)
        if payload.get("tv", 0) != (user.token_version or 0):
            return fail(ERR_UNAUTHORIZED)
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def require_approved(fn):
    """需登录且账号已通过审核(管理员/校友默认已通过)。"""
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        u = g.current_user
        if u.role != "admin" and u.status != "approved":
            return fail(ERR_ACCOUNT_PENDING)
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        if g.current_user.role != "admin":
            return fail(ERR_FORBIDDEN)
        return fn(*args, **kwargs)

    return wrapper

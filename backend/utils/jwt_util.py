"""JWT 签发与校验工具。

决策:Access Token 24 小时,Refresh Token 30 天,HS256。
Payload 结构遵循《安全规范》第 2.3 节。
"""
from datetime import datetime, timezone

import jwt
from flask import current_app


def _now():
    return datetime.now(timezone.utc)


def issue_access_token(user):
    cfg = current_app.config
    iat = _now()
    payload = {
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role,
        "type": "access",
        "iat": iat,
        "exp": iat + cfg["JWT_ACCESS_EXPIRES"],
    }
    return jwt.encode(payload, cfg["JWT_SECRET"], algorithm=cfg["JWT_ALGORITHM"])


def issue_refresh_token(user):
    cfg = current_app.config
    iat = _now()
    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "iat": iat,
        "exp": iat + cfg["JWT_REFRESH_EXPIRES"],
    }
    return jwt.encode(payload, cfg["JWT_SECRET"], algorithm=cfg["JWT_ALGORITHM"])


def decode_token(token, expected_type=None):
    """解码并校验 token。

    返回 (payload, error)。error 取值:None / "expired" / "invalid" / "type"。
    """
    cfg = current_app.config
    try:
        payload = jwt.decode(
            token, cfg["JWT_SECRET"], algorithms=[cfg["JWT_ALGORITHM"]]
        )
    except jwt.ExpiredSignatureError:
        return None, "expired"
    except jwt.InvalidTokenError:
        return None, "invalid"
    if expected_type and payload.get("type") != expected_type:
        return None, "type"
    return payload, None

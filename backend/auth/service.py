"""认证业务逻辑。

设计要点(技术决策定稿 v1.1):
- Q5 解耦:发码限流(60s)与登录锁定(15min/5次)互相独立
- Q3:仅手机号+验证码,不做密码登录;新手机号首次登录自动注册
- Q2:登录成功签发 Access(24h)+ Refresh(30d)
"""
import re
from datetime import datetime, timedelta

from flask import current_app

from extensions import db
from models import User, SmsCode, LoginAttempt
from utils.sms_util import generate_code, send_sms
from utils.jwt_util import issue_access_token, issue_refresh_token

PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
VALID_PURPOSES = {"login", "register", "reset_password"}


def _now():
    return datetime.utcnow()


def is_valid_phone(phone):
    return bool(phone) and bool(PHONE_RE.match(phone))


PASSWORD_MIN_LEN = 8


def is_valid_password(raw):
    """密码强度:≥8 位、同时含字母与数字,且不超过 bcrypt 的 72 字节上限。"""
    if not raw or len(raw) < PASSWORD_MIN_LEN:
        return False
    if len(raw.encode("utf-8")) > 72:
        return False
    has_letter = any(c.isalpha() for c in raw)
    has_digit = any(c.isdigit() for c in raw)
    return has_letter and has_digit


# ---------- 发送验证码 ----------

def can_send_code(phone, purpose):
    """60 秒内同手机号同用途只能发 1 次。返回 (allowed, retry_after_seconds)。"""
    interval = current_app.config["SMS_RESEND_INTERVAL"]
    last = (
        SmsCode.query.filter_by(phone=phone, purpose=purpose)
        .order_by(SmsCode.created_at.desc())
        .first()
    )
    if last is None:
        return True, 0
    elapsed = _now() - last.created_at
    if elapsed < interval:
        return False, int((interval - elapsed).total_seconds()) + 1
    return True, 0


def create_and_send_code(phone, purpose):
    code = generate_code(6)
    ttl = current_app.config["SMS_CODE_TTL"]
    record = SmsCode(
        phone=phone,
        code=code,
        purpose=purpose,
        expires_at=_now() + ttl,
    )
    db.session.add(record)
    db.session.commit()
    send_sms(phone, code, purpose)
    return int(ttl.total_seconds())


# ---------- 登录锁定 ----------

def is_locked(phone):
    """15 分钟内验证码登录失败 >=5 次则锁定。"""
    window = current_app.config["LOGIN_LOCK_DURATION"]
    max_fail = current_app.config["LOGIN_MAX_FAIL"]
    since = _now() - window
    fails = LoginAttempt.query.filter(
        LoginAttempt.phone == phone,
        LoginAttempt.attempt_type == "code",
        LoginAttempt.is_success.is_(False),
        LoginAttempt.attempted_at >= since,
    ).count()
    return fails >= max_fail


def record_attempt(phone, success, ip=None):
    db.session.add(
        LoginAttempt(
            phone=phone,
            attempt_type="code",
            is_success=success,
            ip_address=ip,
        )
    )
    # 成功则清理该号近期失败记录(重置失败计数)
    if success:
        window = current_app.config["LOGIN_LOCK_DURATION"]
        since = _now() - window
        LoginAttempt.query.filter(
            LoginAttempt.phone == phone,
            LoginAttempt.attempt_type == "code",
            LoginAttempt.is_success.is_(False),
            LoginAttempt.attempted_at >= since,
        ).delete(synchronize_session=False)
    db.session.commit()


# ---------- 验证码校验 ----------

# 返回字符串状态码,由 routes 映射到错误码
CODE_OK = "ok"
CODE_NOT_FOUND = "not_found"
CODE_EXPIRED = "expired"
CODE_USED = "used"
CODE_WRONG = "wrong"


def verify_code(phone, code, purpose):
    record = (
        SmsCode.query.filter_by(phone=phone, purpose=purpose)
        .order_by(SmsCode.created_at.desc())
        .first()
    )
    if record is None:
        return CODE_NOT_FOUND, None
    if record.is_used:
        return CODE_USED, record
    if record.expires_at < _now():
        return CODE_EXPIRED, record
    if record.code != code:
        return CODE_WRONG, record
    return CODE_OK, record


# ---------- 用户与令牌 ----------

def get_or_create_user(phone):
    """新手机号首次登录自动注册(Q3)。"""
    user = User.query.filter_by(phone=phone).first()
    if user is None:
        user = User(phone=phone, role="user", points=0)
        db.session.add(user)
        db.session.commit()
    return user


def issue_tokens(user):
    access = issue_access_token(user)
    refresh = issue_refresh_token(user)
    cfg = current_app.config
    user.jwt_token = access
    user.jwt_expires_at = _now() + cfg["JWT_ACCESS_EXPIRES"]
    user.jwt_refresh_token = refresh
    user.jwt_refresh_expires_at = _now() + cfg["JWT_REFRESH_EXPIRES"]
    user.last_login_at = _now()
    db.session.commit()
    return {
        "access_token": access,
        "refresh_token": refresh,
        "expires_in": int(cfg["JWT_ACCESS_EXPIRES"].total_seconds()),
        "refresh_expires_in": int(cfg["JWT_REFRESH_EXPIRES"].total_seconds()),
    }

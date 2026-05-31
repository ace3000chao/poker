"""SQLAlchemy 数据模型(8 张表)。

严格对应《数据库设计文档 v1.0》第三节。
"""
from datetime import datetime

import bcrypt

from extensions import db


def _now():
    return datetime.utcnow()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    phone = db.Column(db.String(20), unique=True, nullable=False, index=True)
    # password_hash:bcrypt 哈希。注册仍走手机号+验证码(无密码),
    # 用户可后续设置密码以启用「手机号 + 密码」登录(feat/password-login)。
    password_hash = db.Column(db.String(128), nullable=True)
    nickname = db.Column(db.String(50), nullable=True)
    role = db.Column(db.String(20), default="user")  # user / admin
    points = db.Column(db.Integer, default=0)
    jwt_token = db.Column(db.Text, nullable=True)
    jwt_expires_at = db.Column(db.DateTime, nullable=True)
    jwt_refresh_token = db.Column(db.Text, nullable=True)
    jwt_refresh_expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)
    last_login_at = db.Column(db.DateTime, nullable=True)

    def set_password(self, raw):
        """用 bcrypt 设置密码哈希。"""
        self.password_hash = bcrypt.hashpw(
            raw.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, raw):
        """校验明文密码;未设置密码时恒为 False。"""
        if not self.password_hash:
            return False
        return bcrypt.checkpw(
            raw.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def has_password(self):
        return bool(self.password_hash)


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    card_key = db.Column(db.String(20), unique=True, nullable=False, index=True)
    suit = db.Column(db.String(10), nullable=False)  # hearts/spades/clubs/diamonds
    rank = db.Column(db.String(5), nullable=False)   # A/2-10/J/Q/K
    alumni_name = db.Column(db.String(50), nullable=False)
    graduation_year = db.Column(db.Integer, nullable=True)
    college = db.Column(db.String(100), nullable=True)
    major = db.Column(db.String(100), nullable=True)
    company_name = db.Column(db.String(100), nullable=True)
    position = db.Column(db.String(100), nullable=True)
    industry = db.Column(db.String(50), nullable=True, index=True)
    business_desc = db.Column(db.String(200), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    # 美工绘制的扑克牌正面图(每张各不相同)
    card_image_url = db.Column(db.String(500), nullable=True)
    contact_phone = db.Column(db.String(20), nullable=True)
    wechat = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    company_address = db.Column(db.String(200), nullable=True)
    founded_year = db.Column(db.Integer, nullable=True)
    team_size = db.Column(db.String(20), nullable=True)
    latest_news = db.Column(db.Text, nullable=True)
    alumni_quote = db.Column(db.String(500), nullable=True)
    extra_data = db.Column(db.Text, nullable=True)  # JSON 字符串
    is_published = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        db.Index("idx_suit_rank", "suit", "rank"),
    )


class SpecialCard(db.Model):
    __tablename__ = "special_cards"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    type = db.Column(db.String(10), unique=True, nullable=False)  # king / joker
    title = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(100), nullable=True)
    logo_url = db.Column(db.String(500), nullable=True)
    # 美工绘制的牌正面图(大王/小王各一张)
    card_image_url = db.Column(db.String(500), nullable=True)
    motto = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    contact_phone = db.Column(db.String(20), nullable=True)
    contact_email = db.Column(db.String(100), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    website_url = db.Column(db.String(200), nullable=True)
    features = db.Column(db.Text, nullable=True)    # JSON 字符串
    extra_data = db.Column(db.Text, nullable=True)  # JSON 字符串
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)


class Game(db.Model):
    __tablename__ = "games"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    icon_url = db.Column(db.String(500), nullable=True)
    config_path = db.Column(db.String(200), nullable=False)
    is_enabled = db.Column(db.Boolean, default=False, index=True)  # 上下架开关
    is_builtin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)


class GameScore(db.Model):
    __tablename__ = "game_scores"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id"), nullable=False)
    game_key = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    cards_used = db.Column(db.Text, nullable=True)   # JSON 数组
    extra_data = db.Column(db.Text, nullable=True)   # JSON 字符串
    points_earned = db.Column(db.Integer, default=0)
    played_at = db.Column(db.DateTime, default=_now)

    __table_args__ = (
        db.Index("idx_user_game", "user_id", "game_id"),
        db.Index("idx_played_at", "played_at"),
    )


class DailyGameCount(db.Model):
    __tablename__ = "daily_game_counts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id"), nullable=False)
    game_date = db.Column(db.Date, nullable=False)
    play_count = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        db.Index(
            "idx_user_game_date", "user_id", "game_id", "game_date", unique=True
        ),
    )


class SmsCode(db.Model):
    __tablename__ = "sms_codes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    phone = db.Column(db.String(20), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    purpose = db.Column(db.String(20), nullable=False)  # login/register/reset_password
    is_used = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    __table_args__ = (
        db.Index("idx_phone_purpose", "phone", "purpose"),
        db.Index("idx_expires_at", "expires_at"),
    )


class LoginAttempt(db.Model):
    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    phone = db.Column(db.String(20), nullable=False)
    attempt_type = db.Column(db.String(20), nullable=False)  # code / password
    is_success = db.Column(db.Boolean, default=False)
    ip_address = db.Column(db.String(50), nullable=True)
    attempted_at = db.Column(db.DateTime, default=_now)

    __table_args__ = (
        db.Index("idx_phone_attempted", "phone", "attempted_at"),
    )


class AppSetting(db.Model):
    """全局键值设置。当前用于:card_back_url(扑克牌统一背面图)。"""

    __tablename__ = "app_settings"

    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

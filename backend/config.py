"""应用配置。

数据库默认指向 /data/poker/poker.db(代码目录外),本地开发可用
环境变量 DATABASE_URL 覆盖为本地 sqlite 文件,避免污染生产路径。
"""
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-prod")

    # 生产:/data/poker/poker.db;本地开发可用 DATABASE_URL 覆盖
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:////data/poker/poker.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT(决策:Access 24h / Refresh 30d,HS256)
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-change-in-prod")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_EXPIRES = timedelta(days=30)

    # 短信验证码
    SMS_CODE_TTL = timedelta(minutes=5)      # 验证码有效期
    SMS_RESEND_INTERVAL = timedelta(seconds=60)  # 同号发送间隔

    # 临时管理员登录(短信未开通前的过渡方案,接入短信后应移除/关闭)
    ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "13424514766")
    ADMIN_TEMP_PASSWORD = os.environ.get("ADMIN_TEMP_PASSWORD", "ZSPT@wmdwp2026")

    # 图片上传(扑克牌正反面)
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/data/poker/uploads")
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 单文件 8MB
    ALLOWED_IMG_EXT = {"png", "jpg", "jpeg", "webp", "gif"}

    # 登录安全
    LOGIN_MAX_FAIL = 5
    LOGIN_LOCK_DURATION = timedelta(minutes=15)


class DevConfig(Config):
    DEBUG = True
    # 本地开发默认用项目内 sqlite 文件,生产用 /data/poker/poker.db
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "poker_dev.db")
    )
    UPLOAD_DIR = os.environ.get(
        "UPLOAD_DIR", os.path.join(BASE_DIR, "uploads")
    )


class ProdConfig(Config):
    DEBUG = False


config_map = {"dev": DevConfig, "prod": ProdConfig}


def get_config():
    return config_map.get(os.environ.get("FLASK_ENV", "dev"), DevConfig)

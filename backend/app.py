"""Flask 应用工厂。

职责:加载配置、初始化扩展、注册安全响应头、健康检查、
核心 Blueprint 与游戏插件。
"""
from flask import Flask
from flask_cors import CORS

from config import get_config
from extensions import db, migrate
from errors import ok
from games.registry import register_games, sync_games_to_db


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())
    app.json.ensure_ascii = False  # 中文按原文返回,不转义为 \uXXXX

    # 扩展初始化
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # 注册模型(供 Flask-Migrate 发现)
    import models  # noqa: F401

    register_security_headers(app)
    register_health(app)
    register_blueprints(app)

    with app.app_context():
        register_games(app)
        try:
            sync_games_to_db(app)
        except Exception as exc:  # noqa: BLE001 首次迁移前表不存在,容忍
            app.logger.warning("games 表同步跳过(可能尚未迁移):%s", exc)

    return app


def register_security_headers(app):
    """《安全规范》第 6.4 节:统一安全响应头。

    注:纯 API + JWT 架构,不使用 Cookie 会话,故不引入 CSRF Token
    (Q4 决策)。
    """
    @app.after_request
    def _add_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response


def register_health(app):
    @app.get("/api/health")
    def health():
        return ok({"status": "up", "service": "poker-platform"})


def register_blueprints(app):
    """注册核心业务 Blueprint。

    已接入:auth(/api/auth)、user(/api/user)、cards(/api/cards)、
    special-cards(/api/special-cards)。待后续:leaderboard / admin。
    """
    from auth.routes import auth_bp, user_bp
    from cards.routes import cards_bp, special_bp
    from leaderboard.routes import leaderboard_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(cards_bp, url_prefix="/api/cards")
    app.register_blueprint(special_bp, url_prefix="/api/special-cards")
    app.register_blueprint(leaderboard_bp, url_prefix="/api/leaderboard")


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000)

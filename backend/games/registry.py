"""游戏插件自动注册。

扫描 backend/games/ 下每个子目录,加载 config.json,导入其
__init__.py 暴露的 `bp` Blueprint,挂载到 /api/games/<game_id>。
"""
import importlib
import json
import os


from flask import g
from errors import ok, fail
from common.scoring import check_availability, ScoringError
from auth.decorators import require_auth

GAMES_DIR = os.path.abspath(os.path.dirname(__file__))


def discover_games():
    """返回 [(game_id, config_dict), ...]。"""
    games = []
    for name in sorted(os.listdir(GAMES_DIR)):
        path = os.path.join(GAMES_DIR, name)
        cfg_file = os.path.join(path, "config.json")
        if not os.path.isdir(path) or not os.path.exists(cfg_file):
            continue
        with open(cfg_file, "r", encoding="utf-8") as f:
            config = json.load(f)
        games.append((name, config))
    return games


def get_game_config(game_id):
    """按 game_id 读取其 config.json,不存在返回 None。"""
    cfg_file = os.path.join(GAMES_DIR, game_id, "config.json")
    if not os.path.exists(cfg_file):
        return None
    with open(cfg_file, "r", encoding="utf-8") as f:
        return json.load(f)


def sync_games_to_db(app):
    """把发现的插件 upsert 到 games 表。

    新游戏按 config.json 的 enabled 落库;已存在的保留 DB 中 is_enabled
    (上下架由管理员后台控制,不被代码覆盖)。
    """
    from extensions import db
    from models import Game

    for game_id, config in discover_games():
        row = Game.query.filter_by(game_id=game_id).first()
        if row is None:
            db.session.add(Game(
                game_id=game_id,
                name=config.get("name", game_id),
                version=config.get("version", "1.0.0"),
                description=config.get("description"),
                config_path=f"games/{game_id}/config.json",
                is_enabled=bool(config.get("enabled", False)),
                is_builtin=True,
            ))
        else:
            row.name = config.get("name", row.name)
            row.version = config.get("version", row.version)
            row.description = config.get("description", row.description)
    db.session.commit()


def register_games(app):
    """发现并注册所有游戏插件 Blueprint。"""
    registered = []
    for game_id, config in discover_games():
        try:
            module = importlib.import_module(f"games.{game_id}")
            bp = getattr(module, "bp", None)
            if bp is None:
                app.logger.warning("游戏 %s 未暴露 bp,跳过", game_id)
                continue
            # ---- register shared /check endpoint for every game ----
            def _make_check_handler(gid):
                def _handler():
                    try:
                        check_availability(g.current_user, gid)
                        return ok()
                    except ScoringError as e:
                        return fail(e.code, e.message)
                return require_auth(_handler)

            bp.add_url_rule(
                "/check",
                f"check_{game_id}",
                view_func=_make_check_handler(game_id),
                methods=["POST"],
            )
            app.register_blueprint(bp, url_prefix=f"/api/games/{game_id}")
            registered.append(game_id)
        except Exception as exc:  # noqa: BLE001 插件隔离,单个失败不影响整体
            app.logger.error("注册游戏 %s 失败:%s", game_id, exc)
    app.logger.info("已注册游戏插件:%s", registered or "(无)")
    return registered

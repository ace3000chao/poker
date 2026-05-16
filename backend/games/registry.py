"""游戏插件自动注册。

扫描 backend/games/ 下每个子目录,加载 config.json,导入其
__init__.py 暴露的 `bp` Blueprint,挂载到 /api/games/<game_id>。
"""
import importlib
import json
import os

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
            app.register_blueprint(bp, url_prefix=f"/api/games/{game_id}")
            registered.append(game_id)
        except Exception as exc:  # noqa: BLE001 插件隔离,单个失败不影响整体
            app.logger.error("注册游戏 %s 失败:%s", game_id, exc)
    app.logger.info("已注册游戏插件:%s", registered or "(无)")
    return registered

"""示例游戏标准路由。

实现《游戏插件接口规范》第三节要求的三个路由:
  GET  /info   获取游戏信息
  POST /play   开始游戏(下发 session)
  POST /score  上报成绩
注:JWT 鉴权依赖公共服务层 @require_auth,待 auth 模块完成后接入,
此处先以 TODO 标注,保证框架可独立验证。
"""
import json
import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request

from errors import ok, fail, ERR_PARAM

bp = Blueprint("demo_game", __name__)

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def _load_config():
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@bp.get("/info")
def info():
    cfg = _load_config()
    return ok({
        "id": cfg["id"],
        "name": cfg["name"],
        "description": cfg["description"],
        "icon": f"/api/games/{cfg['id']}/static/icon.png",
        "settings": cfg["settings"],
    })


@bp.post("/play")
def play():
    # TODO(auth): @require_auth + 今日次数校验(daily_game_counts)
    cfg = _load_config()
    return ok({
        "game_session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "time_limit": cfg["settings"]["time_limit_seconds"],
    })


@bp.post("/score")
def score():
    # TODO(auth): @require_auth + session 校验 + 积分结算 + 写 game_scores
    body = request.get_json(silent=True) or {}
    for field in ("score", "duration", "timestamp"):
        if field not in body:
            return fail(ERR_PARAM, f"缺少必填字段:{field}")
    return ok({
        "earned_points": 0,
        "total_points": 0,
        "rank": None,
        "note": "示例插件:积分结算待公共服务层接入",
    })

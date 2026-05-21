"""示例游戏标准路由。

实现《游戏插件开发指南》第四节的三个标准路由,并接入公共服务层:
  GET  /info   获取游戏信息(公开)
  POST /play   开始游戏(需登录,平台校验下架/每日次数)
  POST /score  上报成绩(需登录,平台统一结算积分,Q6)
插件自身不写积分/不碰数据库,只上报原始成绩。
"""
import json
import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, g

from errors import ok, fail, ERR_PARAM
from auth.decorators import require_auth
from common import scoring
from common.scoring import ScoringError

bp = Blueprint("demo_game", __name__)

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
_GAME_KEY = "demo_game"


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
@require_auth
def play():
    try:
        cfg = scoring.start_session(g.current_user, _GAME_KEY)
    except ScoringError as e:
        return fail(e.code, e.message)
    return ok({
        "game_session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "time_limit": cfg["settings"]["time_limit_seconds"],
    })


@bp.post("/score")
@require_auth
def score():
    body = request.get_json(silent=True) or {}
    for field in ("score", "duration", "timestamp"):
        if field not in body:
            return fail(ERR_PARAM, f"缺少必填字段:{field}")
    try:
        result = scoring.submit_score(g.current_user, _GAME_KEY, body)
    except ScoringError as e:
        return fail(e.code, e.message)
    return ok(result)

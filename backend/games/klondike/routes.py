"""经典克朗代克 —— 游戏插件标准路由。

实现 /info /play /score 三个标准路由,并接入平台公共服务层。
插件自身不写积分、不碰用户表,只上报原始成绩。
"""
import json
import os
import secrets
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, g

from errors import ok, fail, ERR_PARAM
from auth.decorators import require_auth
from common import scoring
from common.scoring import ScoringError

_GAME_KEY = "klondike"
_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

bp = Blueprint(_GAME_KEY, __name__,
               static_folder="static", static_url_path="/static")


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
        "seed": secrets.randbits(32),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "time_limit": cfg["settings"]["time_limit_seconds"],
    })


@bp.post("/score")
@require_auth
def score():
    body = request.get_json(silent=True) or {}
    for field in ("score", "duration", "timestamp", "is_win", "moves", "draw_mode", "stock_resets"):
        if field not in body:
            return fail(ERR_PARAM, f"缺少必填字段:{field}")
    try:
        result = scoring.submit_score(g.current_user, _GAME_KEY, body)
    except ScoringError as e:
        return fail(e.code, e.message)
    return ok(result)
"""排行榜路由(公开可查)。

  GET /api/leaderboard            全局积分榜
  GET /api/leaderboard?game=<id>  指定游戏累计得分榜
"""
from flask import Blueprint, request

from errors import ok
from common import scoring

leaderboard_bp = Blueprint("leaderboard", __name__)


@leaderboard_bp.get("")
@leaderboard_bp.get("/")
def leaderboard():
    game = request.args.get("game")
    try:
        limit = min(int(request.args.get("limit", 50)), 100)
    except ValueError:
        limit = 50
    if game:
        return ok({"scope": "game", "game": game,
                   "items": scoring.game_leaderboard(game, limit)})
    return ok({"scope": "global",
               "items": scoring.global_leaderboard(limit)})

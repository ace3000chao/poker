"""积分统一结算(Q6:游戏插件只上报原始成绩,平台结算)。

游戏插件在 /play 调 start_session,/score 调 submit_score,自身不写积分。
规则来源:games 表 + 该游戏 config.json 的 settings。
"""
from datetime import datetime, date, timedelta

from extensions import db
from models import Game, GameScore, DailyGameCount, User

SCORE_MIN_INTERVAL = timedelta(seconds=10)  # Q1: 42903 上报最小间隔


class ScoringError(Exception):
    """携带全局错误码,由路由转成统一响应。"""

    def __init__(self, code, message=None):
        self.code = code
        self.message = message
        super().__init__(message or str(code))


def _now():
    return datetime.utcnow()


def get_enabled_game(game_key):
    """返回 (Game 行, config dict)。游戏不存在/已下架则抛 ScoringError。"""
    from errors import ERR_GAME_NOT_FOUND, ERR_GAME_OFFLINE

    game = Game.query.filter_by(game_id=game_key).first()
    if game is None:
        raise ScoringError(ERR_GAME_NOT_FOUND)
    if not game.is_enabled:
        raise ScoringError(ERR_GAME_OFFLINE)
    from games.registry import get_game_config
    config = get_game_config(game_key)
    if config is None:
        raise ScoringError(ERR_GAME_NOT_FOUND)
    return game, config


def _today_count(user_id, game_db_id):
    return DailyGameCount.query.filter_by(
        user_id=user_id, game_id=game_db_id, game_date=date.today()
    ).first()


def check_daily_limit(user, game, config):
    """超过 settings.max_daily_games 抛 42902。"""
    from errors import ERR_DAILY_LIMIT

    limit = config.get("settings", {}).get("max_daily_games", 10)
    row = _today_count(user.id, game.id)
    if row and row.play_count >= limit:
        raise ScoringError(ERR_DAILY_LIMIT)



def check_availability(user, game_key):
    game, config = get_enabled_game(game_key)
    check_daily_limit(user, game, config)
    return {
        "game_id": game_key,
        "can_play": True,
        "daily_limit": config.get("settings", {}).get("max_daily_games", 10),
    }


def start_session(user, game_key):
    """/play:校验下架与每日次数,次数 +1。"""
    game, config = get_enabled_game(game_key)
    check_daily_limit(user, game, config)
    row = _today_count(user.id, game.id)
    if row is None:
        row = DailyGameCount(
            user_id=user.id, game_id=game.id,
            game_date=date.today(), play_count=0,
        )
        db.session.add(row)
    row.play_count += 1
    db.session.commit()
    return config


def submit_score(user, game_key, payload):
    """/score:校验间隔,结算积分,写 game_scores,更新用户积分。

    payload 至少含 score/duration/timestamp;is_win 由游戏判定胜负,
    缺省按 score>0 视为胜。
    返回 {earned_points, total_points, rank}。
    """
    from errors import ERR_SCORE_TOO_FAST

    game, config = get_enabled_game(game_key)

    last = (
        GameScore.query.filter_by(user_id=user.id, game_id=game.id)
        .order_by(GameScore.played_at.desc())
        .first()
    )
    if last and (_now() - last.played_at) < SCORE_MIN_INTERVAL:
        raise ScoringError(ERR_SCORE_TOO_FAST)

    settings = config.get("settings", {})
    score = int(payload.get("score", 0))
    is_win = payload.get("is_win")
    if is_win is None:
        is_win = score > 0
    earned = (
        settings.get("points_per_win", 10) if is_win
        else settings.get("points_per_loss", 2)
    )

    import json
    rec = GameScore(
        user_id=user.id,
        game_id=game.id,
        game_key=game_key,
        score=score,
        duration=int(payload.get("duration", 0)),
        cards_used=json.dumps(payload.get("cards_used", []), ensure_ascii=False),
        points_earned=earned,
        played_at=_now(),
    )
    db.session.add(rec)
    user.points = (user.points or 0) + earned
    db.session.commit()

    rank = (
        db.session.query(User).filter(User.points > user.points).count() + 1
    )
    return {
        "earned_points": earned,
        "total_points": user.points,
        "rank": rank,
        "is_win": bool(is_win),
    }


def global_leaderboard(limit=50):
    rows = (
        User.query.filter(User.points > 0)
        .order_by(User.points.desc(), User.id.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "rank": i + 1,
            "user_id": u.id,
            "nickname": u.nickname or f"用户{u.id}",
            "points": u.points,
        }
        for i, u in enumerate(rows)
    ]


def game_leaderboard(game_key, limit=50):
    """按单个游戏累计得分排行。"""
    rows = (
        db.session.query(
            GameScore.user_id,
            db.func.sum(GameScore.score).label("total"),
        )
        .filter(GameScore.game_key == game_key)
        .group_by(GameScore.user_id)
        .order_by(db.text("total DESC"))
        .limit(limit)
        .all()
    )
    out = []
    for i, (uid, total) in enumerate(rows):
        u = User.query.get(uid)
        out.append({
            "rank": i + 1,
            "user_id": uid,
            "nickname": (u.nickname if u else None) or f"用户{uid}",
            "total_score": int(total or 0),
        })
    return out

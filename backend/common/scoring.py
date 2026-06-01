"""积分统一结算(Q6:游戏插件只上报原始成绩,平台结算)。

游戏插件在 /play 调 start_session,/score 调 submit_score,自身不写积分。
规则来源:games 表 + 该游戏 config.json 的 settings。
"""
from datetime import datetime, date, timedelta

from sqlalchemy.exc import IntegrityError

from extensions import db
from models import Game, GameScore, DailyGameCount, User

# 成绩上下界(防止异常/恶意值污染排行榜与用户积分)
MAX_SCORE = 10_000_000
MAX_DURATION = 86_400  # 一天秒数

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


def _require_approved(user):
    """游戏需账号审核通过(管理员/校友默认已通过)。集中在此,无需改各插件。"""
    from errors import ERR_ACCOUNT_PENDING
    if getattr(user, "role", None) != "admin" and getattr(user, "status", "approved") != "approved":
        raise ScoringError(ERR_ACCOUNT_PENDING)


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
    _require_approved(user)
    game, config = get_enabled_game(game_key)
    check_daily_limit(user, game, config)
    return {
        "game_id": game_key,
        "can_play": True,
        "daily_limit": config.get("settings", {}).get("max_daily_games", 10),
    }


def start_session(user, game_key):
    """/play:校验下架与每日剩余次数。

    注意:每日次数的**扣减放在 submit_score**(交分时),而非这里。
    原因:① 开局不交分不应白白消耗额度;② 更重要的是防止客户端
    跳过 /play 直接刷 /score —— 若额度只在 /play 扣,/score 不校验,
    就能无限刷分。现在额度在结算路径强制并原子扣减。
    """
    _require_approved(user)
    game, config = get_enabled_game(game_key)
    check_daily_limit(user, game, config)
    return config


def _increment_daily_count(user_id, game_db_id):
    """原子自增当日计数,避免并发"读-改-写"丢失更新。"""
    today = date.today()
    updated = DailyGameCount.query.filter_by(
        user_id=user_id, game_id=game_db_id, game_date=today
    ).update(
        {DailyGameCount.play_count: DailyGameCount.play_count + 1},
        synchronize_session=False,
    )
    if updated:
        return
    try:
        with db.session.begin_nested():
            db.session.add(DailyGameCount(
                user_id=user_id, game_id=game_db_id,
                game_date=today, play_count=1,
            ))
    except IntegrityError:
        # 并发首次插入撞唯一索引:退化为自增
        DailyGameCount.query.filter_by(
            user_id=user_id, game_id=game_db_id, game_date=today
        ).update(
            {DailyGameCount.play_count: DailyGameCount.play_count + 1},
            synchronize_session=False,
        )


def submit_score(user, game_key, payload):
    """/score:校验间隔,结算积分,写 game_scores,更新用户积分。

    payload 至少含 score/duration/timestamp;is_win 由游戏判定胜负,
    缺省按 score>0 视为胜。
    返回 {earned_points, total_points, rank}。
    """
    from errors import ERR_SCORE_TOO_FAST, ERR_PARAM

    _require_approved(user)
    game, config = get_enabled_game(game_key)

    # 每日上限在结算路径强制(堵住跳过 /play 直接刷分)
    check_daily_limit(user, game, config)

    last = (
        GameScore.query.filter_by(user_id=user.id, game_id=game.id)
        .order_by(GameScore.played_at.desc())
        .first()
    )
    if last and (_now() - last.played_at) < SCORE_MIN_INTERVAL:
        raise ScoringError(ERR_SCORE_TOO_FAST)

    # 输入校验:非数字 / 负数一律拒绝,并钳制上界,避免污染积分与排行榜
    try:
        score = int(payload.get("score", 0))
        duration = int(payload.get("duration", 0))
    except (TypeError, ValueError):
        raise ScoringError(ERR_PARAM)
    if score < 0 or duration < 0:
        raise ScoringError(ERR_PARAM)
    score = min(score, MAX_SCORE)
    duration = min(duration, MAX_DURATION)

    settings = config.get("settings", {})
    is_win = payload.get("is_win")
    if is_win is None:
        is_win = score > 0
    is_win = bool(is_win)
    earned = (
        settings.get("points_per_win", 10) if is_win
        else settings.get("points_per_loss", 2)
    )

    # 原子扣减当日额度(与上面的上限校验共同把刷分封顶到每日上限)
    _increment_daily_count(user.id, game.id)

    import json
    rec = GameScore(
        user_id=user.id,
        game_id=game.id,
        game_key=game_key,
        score=score,
        duration=duration,
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

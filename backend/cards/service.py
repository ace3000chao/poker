"""扑克牌查询与序列化。

- 列表只返回精简字段;详情返回完整 + 解析 extra_data JSON
- 仅 is_published=True 对访客可见
- 搜索覆盖:姓名 / 公司 / 创业描述;另支持 suit / industry 过滤
"""
import json

from models import Card, SpecialCard

# 展示顺序:黑桃 → 红桃 → 梅花 → 方块
SUITS = ("spades", "hearts", "clubs", "diamonds")
# 每种花色内:A、K、Q、J、10 … 3、2
RANK_ORDER = {r: i for i, r in enumerate(
    ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]
)}


def _safe_json(raw):
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return {}


def card_brief(c):
    """列表用精简结构。"""
    return {
        "id": c.id,
        "card_key": c.card_key,
        "suit": c.suit,
        "rank": c.rank,
        "alumni_name": c.alumni_name,
        "company_name": c.company_name,
        "position": c.position,
        "industry": c.industry,
        "business_desc": c.business_desc,
        "avatar_url": c.avatar_url,
        "card_image_url": c.card_image_url,
    }


def card_detail(c):
    """详情用完整结构(含扩展信息与 extra_data)。"""
    return {
        "id": c.id,
        "card_key": c.card_key,
        "suit": c.suit,
        "rank": c.rank,
        "alumni_name": c.alumni_name,
        "graduation_year": c.graduation_year,
        "college": c.college,
        "major": c.major,
        "company_name": c.company_name,
        "position": c.position,
        "industry": c.industry,
        "business_desc": c.business_desc,
        "avatar_url": c.avatar_url,
        "card_image_url": c.card_image_url,
        "contact_phone": c.contact_phone,
        "wechat": c.wechat,
        "email": c.email,
        "company_address": c.company_address,
        "founded_year": c.founded_year,
        "team_size": c.team_size,
        "latest_news": c.latest_news,
        "alumni_quote": c.alumni_quote,
        "extra_data": _safe_json(c.extra_data),
        "is_published": bool(c.is_published),
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def special_detail(s):
    return {
        "id": s.id,
        "type": s.type,
        "title": s.title,
        "subtitle": s.subtitle,
        "logo_url": s.logo_url,
        "card_image_url": s.card_image_url,
        "motto": s.motto,
        "description": s.description,
        "contact_phone": s.contact_phone,
        "contact_email": s.contact_email,
        "address": s.address,
        "website_url": s.website_url,
        "features": _safe_json(s.features),
        "extra_data": _safe_json(s.extra_data),
    }


def query_cards(q=None, suit=None, industry=None):
    query = Card.query.filter(Card.is_published.is_(True))
    if suit:
        query = query.filter(Card.suit == suit)
    if industry:
        query = query.filter(Card.industry == industry)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            Card.alumni_name.like(like)
            | Card.company_name.like(like)
            | Card.business_desc.like(like)
        )
    cards = query.all()
    # 按花色固定序 + 点数 A..K 排序
    cards.sort(key=lambda c: (
        SUITS.index(c.suit) if c.suit in SUITS else 99,
        RANK_ORDER.get(c.rank, 99),
    ))
    return cards


def find_card(key):
    """支持按数字 id 或 card_key(如 hearts_A)查找。"""
    if key.isdigit():
        c = Card.query.get(int(key))
    else:
        c = Card.query.filter_by(card_key=key).first()
    if c is None or not c.is_published:
        return None
    return c


def all_special_cards():
    return SpecialCard.query.all()

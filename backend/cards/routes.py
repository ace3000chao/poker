"""扑克牌档案路由(公开可访问;联系方式仅对已登录用户返回)。"""
from flask import Blueprint, request

from errors import ok, fail, ERR_CARD_NOT_FOUND
from utils.jwt_util import decode_token
from auth.decorators import require_approved
from . import service

cards_bp = Blueprint("cards", __name__)
special_bp = Blueprint("special_cards", __name__)


def _is_authenticated():
    """可选鉴权:带了有效 Access Token 即视为已登录(无效/缺失按匿名,不抛错)。

    这些是公开页面,匿名访客照常拿到除联系方式外的全部信息。
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False
    payload, err = decode_token(auth_header[7:].strip(), expected_type="access")
    return err is None and payload is not None


@cards_bp.get("")
@cards_bp.get("/")
def list_cards():
    q = request.args.get("q")
    suit = request.args.get("suit")
    industry = request.args.get("industry")
    cards = service.query_cards(q=q, suit=suit, industry=industry)
    return ok({
        "total": len(cards),
        "items": [service.card_brief(c) for c in cards],
    })


@cards_bp.get("/<key>")
@require_approved
def get_card(key):
    # 详情页仅对已登录且审核通过的用户开放(访客/待审核看不到)
    c = service.find_card(key)
    if c is None:
        return fail(ERR_CARD_NOT_FOUND)
    return ok(service.card_detail(c, include_contact=True))


@special_bp.get("")
@special_bp.get("/")
def list_special():
    items = service.all_special_cards()
    inc = _is_authenticated()
    return ok({"items": [service.special_detail(s, include_contact=inc) for s in items]})

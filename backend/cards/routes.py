"""扑克牌档案路由(全部公开,访客可访问,无 require_auth)。"""
from flask import Blueprint, request

from errors import ok, fail, ERR_CARD_NOT_FOUND
from . import service

cards_bp = Blueprint("cards", __name__)
special_bp = Blueprint("special_cards", __name__)


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
def get_card(key):
    c = service.find_card(key)
    if c is None:
        return fail(ERR_CARD_NOT_FOUND)
    return ok(service.card_detail(c))


@special_bp.get("")
@special_bp.get("/")
def list_special():
    items = service.all_special_cards()
    return ok({"items": [service.special_detail(s) for s in items]})

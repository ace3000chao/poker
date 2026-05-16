"""占位数据 seed 脚本。

用途:在李智超提供真实数据前,填充 52 张牌 + 大小王占位数据,
供前端扑克牌墙并行开发。所有内容标注【占位】,切勿当真实数据。

用法:cd backend && FLASK_ENV=dev python3 seed.py [--force]
  --force 先清空 cards / special_cards 再重建
"""
import sys

from app import create_app
from extensions import db
from models import Card, SpecialCard

SUITS = ["hearts", "spades", "clubs", "diamonds"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

# 花色 -> 行业(《PRD》花色分类)
SUIT_INDUSTRY = {
    "hearts": "科技",
    "spades": "电商",
    "clubs": "餐饮",
    "diamonds": "制造",
}
SUIT_CN = {"hearts": "红桃", "spades": "黑桃", "clubs": "梅花", "diamonds": "方块"}


def seed_cards():
    n = 0
    for suit in SUITS:
        for rank in RANKS:
            key = f"{suit}_{rank}"
            if Card.query.filter_by(card_key=key).first():
                continue
            label = f"{SUIT_CN[suit]}{rank}"
            db.session.add(Card(
                card_key=key,
                suit=suit,
                rank=rank,
                alumni_name=f"【占位】校友{label}",
                graduation_year=2010 + (RANKS.index(rank) % 12),
                college="创新创业学院",
                major="占位专业",
                company_name=f"【占位】{label}科技有限公司",
                position="创始人",
                industry=SUIT_INDUSTRY[suit],
                business_desc=f"【占位数据】{label} 创业项目简介,待替换为真实内容。",
                avatar_url=None,
                is_published=True,
            ))
            n += 1
    db.session.commit()
    return n


def seed_special():
    specials = [
        dict(type="king", title="中山职业技术学院", subtitle="大王",
             motto="【占位】校训", description="【占位】学校简介,待提供。",
             website_url="https://www.zspt.edu.cn"),
        dict(type="joker", title="创新创业学院", subtitle="小王",
             motto="【占位】院训", description="【占位】学院简介,待提供。"),
    ]
    n = 0
    for s in specials:
        if SpecialCard.query.filter_by(type=s["type"]).first():
            continue
        db.session.add(SpecialCard(**s))
        n += 1
    db.session.commit()
    return n


def main():
    force = "--force" in sys.argv
    app = create_app()
    with app.app_context():
        if force:
            Card.query.delete()
            SpecialCard.query.delete()
            db.session.commit()
            print("已清空 cards / special_cards")
        c = seed_cards()
        s = seed_special()
        print(f"seed 完成:新增 {c} 张普通牌,{s} 张特殊牌")
        print(f"当前总计:cards={Card.query.count()} special={SpecialCard.query.count()}")


if __name__ == "__main__":
    main()

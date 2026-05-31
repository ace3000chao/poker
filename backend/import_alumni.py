"""从 docs/name.xlsx 导入 52 张校友牌 + 大小王真实数据。

设计要点
--------
本脚本**只依赖 Python 标准库**(zipfile/xml 解析 xlsx,sqlite3 写库),
不需要 openpyxl 或 Flask —— 因为 dev 本地机无法安装第三方包。
因此可在 dev 本地与测试服直接 `python3 import_alumni.py` 运行。

数据库路径解析与 config.py 一致:
  - 默认走 FLASK_ENV(dev → backend/poker_dev.db,prod → /data/poker/poker.db)
  - 可用环境变量 DATABASE_URL 覆盖(形如 sqlite:///abs/path.db)

幂等:按 card_key / special.type upsert,可重复运行。
用法:
  FLASK_ENV=dev  python3 import_alumni.py            # 写本地 dev 库
  FLASK_ENV=prod python3 import_alumni.py            # 写生产库(测试服)
  python3 import_alumni.py --dry-run                 # 只解析打印,不写库
  python3 import_alumni.py --xlsx /path/to/name.xlsx # 指定 Excel

字段映射(见仓库 memory / models.py::Card)
  B 包含牌型 → rank(A/K/Q/J/2..10,Excel 中纵向合并,按 4 行块向下填充)
  C 牌型图案 → suit(黑桃→spades 梅花→clubs 方块/方抉→diamonds 红桃→hearts)
  E 姓名      → alumni_name
  F 联系方式  → 智能分类:11 位手机号→contact_phone;"微信:xxx"→wechat;网址→extra_data.website
  G 专业      → major
  H 毕业时间  → graduation_year(从文本提取 4 位年份)
  I 公司Logo  → company_name(该列文本多为公司名,如"41财经""中山市触电网络有限公司")
  J 座右铭    → alumni_quote
  K 一句话业务范围 → business_desc
  M 其他      → extra_data.website(网址) / extra_data.other(其它文本)
  缺失列(position/industry/college/email 等)留 null。
  嵌入图片(公司Logo/二维码)本脚本暂不处理,留待美工正面图与 logo 上传环节。
"""
import json
import os
import re
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

SUIT_MAP = {
    "黑桃": "spades",
    "梅花": "clubs",
    "方块": "diamonds",
    "方抉": "diamonds",   # Excel 中的错别字
    "红桃": "hearts",
}

# 大小王(行 3 / 4)
JOKER_ROWS = {3: ("king", "大王"), 4: ("joker", "小王")}

ALUMNI_FIRST_ROW = 5
ALUMNI_LAST_ROW = 56   # 行 57 是"工作人员",无数据,跳过


# ---------------------------------------------------------------- xlsx 解析
def _col_to_num(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - 64)
    return col, int(m.group(2))


def parse_xlsx(path):
    """返回 {row_number: {col_number: text}}。"""
    z = zipfile.ZipFile(path)
    shared = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
        shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

    rows = {}
    for row in sheet.iter(NS + "row"):
        for c in row.findall(NS + "c"):
            col, rn = _col_to_num(c.get("r"))
            t = c.get("t")
            v = c.find(NS + "v")
            inline = c.find(NS + "is")
            val = ""
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif inline is not None:
                val = "".join(x.text or "" for x in inline.iter(NS + "t"))
            elif v is not None:
                val = v.text
            rows.setdefault(rn, {})[col] = val
    return rows


# ---------------------------------------------------------------- 字段清洗
def clean(s):
    return (s or "").strip()


def parse_year(s):
    m = re.search(r"(19|20)\d{2}", s or "")
    return int(m.group(0)) if m else None


def classify_contact(raw):
    """F 列智能分类 → (contact_phone, wechat, website)。"""
    s = clean(raw)
    if not s:
        return None, None, None
    # 微信:xxx / 微信：xxx
    m = re.match(r"^微信[:：]\s*(.+)$", s)
    if m:
        return None, m.group(1).strip(), None
    # 纯手机号
    if re.fullmatch(r"1\d{10}", s):
        return s, None, None
    # 网址 / 域名
    if re.search(r"(https?://|www\.|\.com|\.cn|\.net)", s, re.I):
        return None, None, s
    # 其它(座机等)归到 contact_phone
    return s, None, None


URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.I)


def parse_other(raw):
    """M 列 → (websites:list, other_text:str|None)。"""
    s = clean(raw)
    if not s:
        return [], None
    parts = re.split(r"[\s\n]+", s)
    urls = [p for p in parts if URL_RE.match(p)]
    rest = " ".join(p for p in parts if not URL_RE.match(p)).strip()
    return urls, (rest or None)


def build_records(rows):
    """解析出 (cards:list[dict], jokers:list[dict])。"""
    cards = []
    cur_rank = None
    for rn in range(ALUMNI_FIRST_ROW, ALUMNI_LAST_ROW + 1):
        r = rows.get(rn, {})
        rank_cell = clean(r.get(2))      # B 列(合并,仅块首有值)
        if rank_cell:
            cur_rank = rank_cell
        suit_cn = clean(r.get(3))        # C 列
        suit = SUIT_MAP.get(suit_cn)
        name = clean(r.get(5))
        if not suit or not cur_rank or not name:
            print(f"  ⚠ 跳过行 {rn}:suit={suit_cn!r} rank={cur_rank!r} name={name!r}")
            continue

        phone, wechat, web1 = classify_contact(r.get(6))   # F
        websites, other = parse_other(r.get(13))            # M
        if web1:
            websites = [web1] + websites

        extra = {}
        if websites:
            extra["website"] = websites[0] if len(websites) == 1 else websites
        if other:
            extra["other"] = other

        cards.append(dict(
            card_key=f"{suit}_{cur_rank}",
            suit=suit,
            rank=cur_rank,
            alumni_name=name,
            graduation_year=parse_year(r.get(8)),    # H
            major=clean(r.get(7)) or None,           # G
            company_name=clean(r.get(9)) or None,    # I(公司Logo 文本)
            alumni_quote=clean(r.get(10)) or None,   # J 座右铭
            business_desc=clean(r.get(11)) or None,  # K 一句话业务范围
            contact_phone=phone,
            wechat=wechat,
            extra_data=json.dumps(extra, ensure_ascii=False) if extra else None,
            # Excel 无对应列,显式置 null —— 否则会残留 seed.py 的占位值
            # (如 position="创始人"、按花色臆测的 industry),误导真实数据
            position=None,
            industry=None,
            college=None,
        ))

    jokers = []
    for rn, (jtype, subtitle) in JOKER_ROWS.items():
        title = clean(rows.get(rn, {}).get(5))
        if title:
            jokers.append(dict(type=jtype, title=title, subtitle=subtitle))
    return cards, jokers


# ---------------------------------------------------------------- 写库
def resolve_db_path():
    url = os.environ.get("DATABASE_URL")
    if not url:
        env = os.environ.get("FLASK_ENV", "dev")
        base = os.path.abspath(os.path.dirname(__file__))
        url = ("sqlite:///" + os.path.join(base, "poker_dev.db")
               if env == "dev" else "sqlite:////data/poker/poker.db")
    if not url.startswith("sqlite:///"):
        raise SystemExit(f"本脚本仅支持 sqlite,当前 DATABASE_URL={url}")
    # sqlite:///rel.db → "rel.db";sqlite:////abs.db → "/abs.db"(第 4 个斜杠保留)
    return url.replace("sqlite:///", "", 1)


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def upsert_cards(conn, cards):
    cols = ["card_key", "suit", "rank", "alumni_name", "graduation_year",
            "major", "company_name", "alumni_quote", "business_desc",
            "contact_phone", "wechat", "extra_data",
            "position", "industry", "college"]
    ins = upd = 0
    for c in cards:
        row = conn.execute("SELECT id FROM cards WHERE card_key=?",
                           (c["card_key"],)).fetchone()
        if row:
            sets = ", ".join(f"{k}=?" for k in cols) + ", updated_at=?"
            conn.execute(f"UPDATE cards SET {sets} WHERE card_key=?",
                         [c[k] for k in cols] + [_now(), c["card_key"]])
            upd += 1
        else:
            allcols = cols + ["is_published", "created_at", "updated_at"]
            ph = ", ".join("?" * len(allcols))
            conn.execute(f"INSERT INTO cards ({', '.join(allcols)}) VALUES ({ph})",
                         [c[k] for k in cols] + [1, _now(), _now()])
            ins += 1
    return ins, upd


def upsert_jokers(conn, jokers):
    ins = upd = 0
    for j in jokers:
        row = conn.execute("SELECT id FROM special_cards WHERE type=?",
                           (j["type"],)).fetchone()
        if row:
            # Excel 只给了大小王名称(无座右铭/简介)。清掉 seed 残留的【占位】
            # motto/description,避免公众端显示占位文案;真实值留待管理员后台填。
            # 仅在含「占位」时清,保证重复运行不会抹掉后台已录入的真实内容。
            conn.execute(
                "UPDATE special_cards SET title=?, subtitle=?, "
                "motto=CASE WHEN motto LIKE '%占位%' THEN NULL ELSE motto END, "
                "description=CASE WHEN description LIKE '%占位%' THEN NULL ELSE description END, "
                "updated_at=? WHERE type=?",
                (j["title"], j["subtitle"], _now(), j["type"]))
            upd += 1
        else:
            conn.execute("INSERT INTO special_cards (type, title, subtitle, created_at, "
                         "updated_at) VALUES (?,?,?,?,?)",
                         (j["type"], j["title"], j["subtitle"], _now(), _now()))
            ins += 1
    return ins, upd


# ---------------------------------------------------------------- main
def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    xlsx = "docs/name.xlsx"
    if "--xlsx" in args:
        xlsx = args[args.index("--xlsx") + 1]
    if not os.path.isfile(xlsx):
        # 兼容从 backend/ 目录运行
        alt = os.path.join(os.path.dirname(__file__), "..", "docs", "name.xlsx")
        xlsx = alt if os.path.isfile(alt) else xlsx
    if not os.path.isfile(xlsx):
        raise SystemExit(f"找不到 Excel:{xlsx}")

    rows = parse_xlsx(xlsx)
    cards, jokers = build_records(rows)
    print(f"解析:{len(cards)} 张校友牌,{len(jokers)} 张大小王(来源 {xlsx})")
    print("示例:")
    for c in cards[:3]:
        print("  ", {k: v for k, v in c.items() if v not in (None, "")})

    if dry:
        print("\n[dry-run] 不写库。")
        return

    db_path = resolve_db_path()
    print(f"\n写入数据库:{db_path}")
    if not os.path.isfile(db_path):
        raise SystemExit(f"数据库不存在(请先 flask db upgrade):{db_path}")
    conn = sqlite3.connect(db_path)
    try:
        ci, cu = upsert_cards(conn, cards)
        ji, ju = upsert_jokers(conn, jokers)
        conn.commit()
    finally:
        conn.close()
    print(f"完成:cards 新增 {ci} / 更新 {cu};special_cards 新增 {ji} / 更新 {ju}")


if __name__ == "__main__":
    main()

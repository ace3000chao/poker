"""内测期批量预置测试账号 + 初始密码。

背景:短信下发仍是桩(`utils/sms_util.py` 只把验证码写日志),内测期测试者
拿不到验证码。本脚本由管理员预先建好账号并设初始密码,测试者用
「手机号 + 密码」(`POST /api/auth/login-password`)登录,绕开短信。
登录后测试者可在 `/api/auth/set-password` 自行改密。

用法(在测试服 backend 目录):
  FLASK_ENV=prod python3 seed_test_users.py 13800138001 13800138002 ...
  FLASK_ENV=prod python3 seed_test_users.py --file testers.txt
  FLASK_ENV=prod python3 seed_test_users.py --file testers.txt --password Test@2026
  FLASK_ENV=prod python3 seed_test_users.py 13800138001 --admin          # 设为管理员
  FLASK_ENV=prod python3 seed_test_users.py --file testers.txt --reset    # 覆盖已存在账号的密码
  FLASK_ENV=prod python3 seed_test_users.py --file testers.txt --dry-run  # 只预览不写库

--file 每行一个手机号,可选用逗号附带「密码」「角色」:
  13800138001
  13800138002,Pw20260601
  13800138003,Pw20260601,admin
未指定密码时,统一用 --password 的值;若也没给,则为每个账号随机生成一个
合规密码(≥8 位、含字母与数字)。脚本结束会打印「手机号 / 初始密码 / 角色」
凭据表,请管理员妥善分发后及时清理。

幂等:已存在的账号默认**跳过**(不动其密码);加 --reset 才会重置密码。
"""
import secrets
import string
import sys

from app import create_app
from auth.service import is_valid_password
from extensions import db
from models import User

# 校验手机号:与 auth.service.is_valid_phone 保持一致(11 位、1 开头)
import re
PHONE_RE = re.compile(r"^1\d{10}$")


def gen_password():
    """随机生成满足强度策略的初始密码(10 位,含字母+数字)。"""
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(10))
        if is_valid_password(pw):
            return pw


def parse_args(argv):
    opts = {"file": None, "password": None, "admin": False,
            "reset": False, "dry_run": False, "phones": []}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--file":
            opts["file"] = argv[i + 1]; i += 2
        elif a == "--password":
            opts["password"] = argv[i + 1]; i += 2
        elif a == "--admin":
            opts["admin"] = True; i += 1
        elif a == "--reset":
            opts["reset"] = True; i += 1
        elif a == "--dry-run":
            opts["dry_run"] = True; i += 1
        else:
            opts["phones"].append(a); i += 1
    return opts


def load_entries(opts):
    """返回 [(phone, password|None, role)]。命令行手机号与 --file 合并。"""
    entries = []
    for p in opts["phones"]:
        entries.append((p.strip(), None, "admin" if opts["admin"] else "user"))
    if opts["file"]:
        with open(opts["file"], encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = [x.strip() for x in line.split(",")]
                phone = parts[0]
                pw = parts[1] if len(parts) > 1 and parts[1] else None
                role = parts[2] if len(parts) > 2 and parts[2] else (
                    "admin" if opts["admin"] else "user")
                entries.append((phone, pw, role))
    return entries


def main():
    opts = parse_args(sys.argv[1:])
    entries = load_entries(opts)
    if not entries:
        print(__doc__)
        sys.exit(1)

    results = []   # (phone, password_shown, role, action)
    app = create_app()
    with app.app_context():
        for phone, pw, role in entries:
            if not PHONE_RE.match(phone):
                print(f"  ⚠ 跳过非法手机号:{phone!r}")
                continue
            if role not in ("user", "admin"):
                role = "user"
            password = pw or opts["password"] or gen_password()
            if not is_valid_password(password):
                print(f"  ⚠ 跳过 {phone}:密码不满足策略(≥8 位、含字母与数字)")
                continue

            user = User.query.filter_by(phone=phone).first()
            if user is None:
                user = User(phone=phone, role=role, points=0, status="approved")
                user.set_password(password)
                db.session.add(user)
                results.append((phone, password, role, "新建"))
            else:
                changed = []
                if user.status != "approved":
                    user.status = "approved"; changed.append("置为已通过")
                if user.role != role and role == "admin":
                    user.role = "admin"; changed.append("提权admin")
                if opts["reset"]:
                    user.set_password(password); changed.append("重置密码")
                    shown = password
                else:
                    shown = "(保留原密码)"
                results.append((phone, shown, user.role,
                                "更新:" + ("/".join(changed) if changed else "无改动")))

        if opts["dry_run"]:
            db.session.rollback()
            print("[dry-run] 不写库。\n")
        else:
            db.session.commit()

    # 凭据表
    print(f"\n{'手机号':<14}{'初始密码':<16}{'角色':<8}{'操作'}")
    print("-" * 52)
    for phone, pw, role, action in results:
        print(f"{phone:<14}{pw:<16}{role:<8}{action}")
    print(f"\n共处理 {len(results)} 个账号"
          + ("(dry-run,未写库)" if opts["dry_run"] else "") + "。")
    print("⚠ 初始密码请安全分发给测试者,并提示其登录后到「修改密码」自行改密。")


if __name__ == "__main__":
    main()

"""把指定手机号设为管理员(不存在则创建)。

正式管理员账号待李智超提供。开发/测试期用本脚本设管理员:
  cd backend && FLASK_ENV=prod python3 set_admin.py 13800138000
登录方式仍为手机号+验证码(Q3 不做密码),该号验证码登录后即拥有 admin 权限。
"""
import sys

from app import create_app
from extensions import db
from models import User


def main():
    if len(sys.argv) < 2:
        print("用法: python3 set_admin.py <手机号>")
        sys.exit(1)
    phone = sys.argv[1].strip()
    app = create_app()
    with app.app_context():
        u = User.query.filter_by(phone=phone).first()
        if u is None:
            u = User(phone=phone, role="admin", points=0)
            db.session.add(u)
            action = "已创建并设为管理员"
        else:
            u.role = "admin"
            action = "已提升为管理员"
        db.session.commit()
        print(f"{action}: id={u.id} phone={u.phone} role={u.role}")


if __name__ == "__main__":
    main()

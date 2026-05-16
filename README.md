# 我们的王牌 —— 扑克游戏平台

中山职业技术学院 20 周年校庆项目。以 52 张扑克牌形式展示创业校友信息,并提供插件式游戏平台。

## 技术栈

- 后端:Python Flask + Flask-SQLAlchemy + Flask-Migrate
- 前端:React + Vite + Tailwind CSS(移动端优先)
- 数据库:SQLite(生产 `/data/poker/poker.db`)
- 认证:JWT 双 Token(Access 24h / Refresh 30d)

## 目录结构

```
backend/        Flask 后端
  app.py        应用工厂
  config.py     配置
  extensions.py 扩展实例
  models.py     SQLAlchemy 模型(8 张表)
  games/        游戏插件目录(自动注册)
  migrations/   Flask-Migrate 迁移
frontend/       React + Vite + Tailwind 前端
docs/           技术文档定稿(PRD / 数据库 / 插件规范 / 安全规范)
开发启动清单.md  开发启动核对单(决策记录)
```

## 本地开发

```bash
# 后端
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
flask db upgrade
flask run

# 前端
cd frontend
npm install
npm run dev
```

## 环境

- 开发:dev 本地机
- 测试/调试:106.55.169.208(OpenCloudOS 9,宝塔面板)

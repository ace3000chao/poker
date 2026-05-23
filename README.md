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

## 贡献

本项目走 **GitHub Flow + Fork-and-PR**,`main` 受保护,所有改动通过 PR。

- 第三方插件开发者:先看 [《游戏插件开发指南》](docs/游戏插件开发指南.md),再走 [`CONTRIBUTING.md`](CONTRIBUTING.md) 的 Fork-and-PR 流程。
- 平台改动:直接在主仓开 `feat/<desc>` / `fix/<desc>` / `docs/<desc>` 分支提 PR。
- 测试服一键部署:`./scripts/deploy-test.sh`(首次用前按脚本头部 TODO 改路径/服务名)。

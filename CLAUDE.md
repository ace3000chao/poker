# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

"我们的王牌" —— 中山职业技术学院 20 周年校庆扑克游戏平台。以 52 张扑克牌 + 大小王形式展示创业校友档案,并提供插件式小游戏 + 积分排行榜。后端 Flask,前端 React/Vite,数据库 SQLite。

## 常用命令

### 后端(backend/)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

flask db upgrade                       # 应用迁移(建表)
flask db migrate -m "描述"             # 模型改动后生成新迁移
FLASK_ENV=dev flask run                # 本地起服务,默认 :5000

FLASK_ENV=dev python3 seed.py [--force]   # 灌 52 张牌 + 大小王占位数据(--force 先清空)
FLASK_ENV=prod python3 set_admin.py <手机号>  # 把某手机号设为管理员
```

`flask` 命令自动发现 `app.py` 中的 `create_app` 工厂,无需设 `FLASK_APP`。

### 前端(frontend/)

```bash
cd frontend
npm install
npm run dev      # Vite 开发服务器 :5173,/api 代理到 localhost:5000
npm run build    # 产出 dist/
```

### 测试

仓库当前**没有自动化测试**。验证改动靠手动跑服务 + 调接口。

## 环境与配置

- `FLASK_ENV` 决定配置类(`config.py` 的 `config_map`):`dev`(默认)/ `prod`。
- 数据库:dev 用项目内 `backend/poker_dev.db`,prod 用 `/data/poker/poker.db`;均可用环境变量 `DATABASE_URL` 覆盖。
- 上传目录:dev 为 `backend/uploads/`,prod 为 `/data/poker/uploads/`,可用 `UPLOAD_DIR` 覆盖。
- 生产必须用环境变量覆盖 `SECRET_KEY` / `JWT_SECRET`(默认值仅供开发)。
- 开发/测试在 dev 本地机,部署/调试在测试服务器 `106.55.169.208`(OpenCloudOS 9 + 宝塔面板)。

## 架构要点

### 后端结构

应用工厂 `app.py::create_app` 负责:加载配置 → 初始化扩展 → 注册安全响应头 → 注册核心 Blueprint → 注册游戏插件并同步到 DB。

核心 Blueprint 与前缀:`auth`(`/api/auth`)、`user`(`/api/user`)、`cards`(`/api/cards`)、`special_cards`(`/api/special-cards`)、`leaderboard`(`/api/leaderboard`)、`admin`(`/api/admin`)。

### 统一响应与错误码

所有接口返回 `{"code": int, "message": str, "data": any}`,HTTP 状态码通常恒为 200,业务结果看 `code`(`0` 为成功)。用 `errors.py` 的 `ok()` / `fail()` 构造响应。

**错误码是全局唯一分段表**(`errors.py`):`400xx` 参数/业务、`401xx` 认证、`403xx` 权限、`404xx` 资源不存在、`423xx` 锁定、`429xx` 限流、`500xx` 服务器。新增错误码必须在该表里保持唯一,不要复用数字。

### 游戏插件机制(关键)

游戏是热插拔插件,理解它需同时看 `games/registry.py`、`common/scoring.py` 和 `games/demo_game/`(参考实现)。

一个插件 = `backend/games/<game_id>/` 目录,内含:
- `config.json` —— `id`/`name`/`version`/`enabled`/`settings`(`max_daily_games`、`points_per_win`、`points_per_loss` 等)。
- `__init__.py` —— 必须暴露名为 `bp` 的 Flask Blueprint。
- `routes.py` —— 实现标准三接口:`GET /info`、`POST /play`、`POST /score`。

启动时 `registry.py` 扫描目录:`register_games()` 把每个 `bp` 挂到 `/api/games/<game_id>`(单个插件失败被隔离,不影响整体);`sync_games_to_db()` 把插件 upsert 进 `games` 表 —— **新插件按 `config.json` 的 `enabled` 落库,已存在的保留 DB 中 `is_enabled`**(上下架由管理员后台控制,不被代码覆盖)。

**积分由平台统一结算,插件不碰积分/数据库**:插件在 `/play` 调 `scoring.start_session`(校验下架与每日次数),在 `/score` 调 `scoring.submit_score`(校验上报间隔、按 `config.json` 的 `settings` 结算积分、写 `game_scores`、更新用户积分)。插件只上报原始成绩。`scoring` 层用 `ScoringError(code)` 抛错,路由用 `fail(e.code)` 转成响应。

### 认证

仅手机号 + 短信验证码登录,新手机号首次登录自动注册(无密码登录)。登录签发 JWT 双 Token:Access 24h / Refresh 30d,HS256。

- 鉴权用 `auth/decorators.py` 的 `@require_auth` / `@require_admin`,校验 `Authorization: Bearer <token>` 后把 `User` 挂到 `g.current_user`。
- 短信工具 `utils/sms_util.py` 当前是**桩实现**(验证码只打日志,不真实下发),接入服务商时替换 `send_sms()`。
- `/api/auth/admin-login` 是短信未开通前的**临时管理员登录**(校验 `config.py` 的 `ADMIN_PHONE` + `ADMIN_TEMP_PASSWORD`),接入短信后应下线。

### 数据模型

`models.py` 共 8 张表:`users`、`cards`(校友牌)、`special_cards`(大小王)、`games`、`game_scores`、`daily_game_counts`、`sms_codes`、`login_attempts`,外加 `app_settings` 键值表(如 `card_back_url` 扑克牌统一背面图)。改模型后须 `flask db migrate` 生成迁移。

### 前端

React Router 单页应用。`src/api.js` 统一封装请求:自动拆 `{code,message,data}` 信封,`code!==0` 抛 `Error`(带 `.code`);`auth:true` 的请求带 Bearer Token(存于 localStorage `poker_access_token`)。`/admin` 路由是独立全屏后台,无公众端顶栏/底栏。配色走学校 VI(`tailwind.config.js` 的 `school` / `schoolred` 色板)。

## 协作流程

本仓采用 **GitHub Flow + Fork-and-PR**。默认分支 `main` 受保护,**不要直接 `commit` 到 `main`**——
任何改动先开分支(`feat/...` / `fix/...` / `docs/...` / `plugin/<game_id>`),推到 GitHub 后开 PR,
等 CI 绿 + reviewer approve 后再合。完整流程见 `CONTRIBUTING.md`,CI 配置在 `.github/workflows/ci.yml`。
插件 PR 有目录沙盒检查:CI 会拒绝改动 `backend/` 平台核心文件的插件 PR。

测试服部署:合并后跑 `./scripts/deploy-test.sh`(脚本头部 TODO 路径/服务名需先按测试服实际填写)。

## 文档

`docs/` 有定稿技术文档。冲突时**以 `docs/技术决策定稿-v1.1.md` 为准**(Q1–Q7 最终决策)。`开发启动清单.md` 记录了各项关键决策的来龙去脉(错误码重建、JWT 时长、不做密码登录、不用 CSRF、限流解耦、积分统一结算等)。

`docs/游戏插件开发指南.md` 是面向第三方插件开发者的**活文档**。改动以下文件且影响到插件契约时,必须同步更新该指南(其末尾"本文档维护约定"列了对应章节):`errors.py`、`games/registry.py`、`common/scoring.py`、`games/demo_game/`、`auth/decorators.py`、`config.py`、`config.json` 字段约定。

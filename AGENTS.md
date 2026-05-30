# AGENTS.md

"我们的王牌" —— 中山职业技术学院 20 周年校庆扑克游戏平台。以 52 张扑克牌 + 大小王展示创业校友档案，提供插件式小游戏 + 积分排行榜。

## 快速命令

```bash
# 后端（Flask 自动发现 app.py::create_app，无需设 FLASK_APP）
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
flask db upgrade                                    # 建表
FLASK_ENV=dev python seed.py                        # 灌 52 张牌 + 大小王占位数据
FLASK_ENV=dev flask run                             # 启动在 :5000

# 前端（React + Vite + Tailwind，移动端优先）
cd frontend
npm install && npm run dev                          # Vite :5173，/api 代理到 :5000

# 获取开发 Token（临时管理员登录）
curl -X POST http://localhost:5000/api/auth/admin-login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13424514766","password":"ZSPT@wmdwp2026"}'
# → data.access_token

# 冒烟测试插件
curl http://localhost:5000/api/games/spider_solitaire/info
curl -X POST http://localhost:5000/api/games/spider_solitaire/play \
  -H "Authorization: Bearer <token>"
```

## 架构要点

- **入口**：`backend/app.py::create_app()` — 加载配置 → 初始化扩展 → 注册 Blueprint → 注册游戏插件 → 同步 DB
- **核心 Blueprint**：`auth`(/api/auth)、`user`(/api/user)、`cards`(/api/cards)、`special_cards`(/api/special-cards)、`leaderboard`(/api/leaderboard)、`admin`(/api/admin)
- **游戏插件**：`backend/games/registry.py` 扫描子目录 → 导入 `__init__.py` 的 `bp` → 挂到 `/api/games/<game_id>/`。单插件失败被隔离，不影响整体。
- **积分**：统一由 `common/scoring.py` 结算（Q6 决策）。插件 `/play` 调 `scoring.start_session()`，`/score` 调 `scoring.submit_score()`，自身不写积分/不碰数据库。
- **认证**：手机号 + 短信验证码，JWT 双 Token（Access 24h / Refresh 30d，HS256）。鉴权用 `@require_auth` / `@require_admin`。
- **响应格式**：恒为 HTTP 200，`{"code": int, "message": str, "data": any}`。`code==0` 成功，`code!=0` 看 `errors.py` 全局唯一错误码表。

## 开发环境特性（易踩坑）

- **短信桩**：验证码不打真实短信，打印在 Flask 日志 `[SMS-STUB] code=XXXXXX`
- **数据库**：dev 用项目内 `poker_dev.db`，prod 用 `/data/poker/poker.db`，均可被 `DATABASE_URL` 覆盖
- **上传目录**：dev 为 `backend/uploads/`，prod 为 `/data/poker/uploads/`，可被 `UPLOAD_DIR` 覆盖
- **限流**：`/score` 同一用户+同一游戏须 ≥10 秒间隔，超则返回 `42903`
- **无自动化测试**：验证全靠手动跑服务+调接口
- **无 lint/formatter/typecheck 配置**

## 插件硬性规则

- 目录名 = `config.json` 的 `id` = 代码 `_GAME_KEY`，三者必须一致
- `__init__.py` 必须暴露名为 `bp` 的 Flask Blueprint
- ❌ 不许动 `users`、`game_scores`、`daily_game_counts` 表
- ❌ 不许自行计算或发放积分
- ❌ 不许修改 `backend/app.py`、`errors.py`、`registry.py`、`common/scoring.py` 等平台核心文件
- ❌ 不许自定义错误码数字
- `config.json` 的 `enabled` 仅首次入库生效，后续上下架走管理后台
- 插件私有数据表需自行处理迁移（Flask-Migrate 仅覆盖平台核心 8 张表）

## 已有插件

| 插件 | 位置 | 状态 |
|------|------|------|
| 蜘蛛纸牌 | `backend/games/spider_solitaire/` + `frontend/src/pages/SpiderSolitaire.jsx` | 已测试（2 色，前端 `/game/spider_solitaire` 可玩） |
| demo | `backend/games/demo_game/` | 平台参考实现 |

## Git 工作流

- `main` 受保护，禁止直推
- 分支命名：`plugin/<id>` / `feat/<desc>` / `fix/<desc>` / `docs/<desc>`
- 插件 PR 的 CI 会沙盒检查：只允许改动 `backend/games/<id>/` 目录
- PR 合并后跑 `./scripts/deploy-test.sh` 部署到测试服 `106.55.169.208`

## 开发工作流（Agent 必读）

每次改动必须按以下顺序执行：

1. **读上下文** — 读 `AGENTS.md`、`docs/agent-collaboration.md`、`docs/agent-update-log.md`，了解项目现状
2. **Hazard 检查** — 确认不碰禁止文件，不改数据库 schema 则无需 migration，不改响应格式
3. **写代码**
4. **验证** — `vite build` 编译通过（前端改动时）
5. **写文档** — 更新 `docs/agent-update-log.md`，记录目标、变更文件、Hazard 检查结果、风险
6. **记模式**（可选）— 若产生可复用规则，用 `memory-management` 存储

## 文档

- `CLAUDE.md` — 平台级指令（与本文互补）
- `docs/agent-collaboration.md` — 多 Agent 协作指南（含 Hazard 清单）
- `docs/agent-update-log.md` — 每次会话的变更日志
- `docs/游戏插件开发指南.md` — 面向插件开发者的活文档
- `开发启动清单.md` — 关键决策记录（Q1-Q7）
- 改动以下文件且影响插件契约时，须同步更新 `docs/游戏插件开发指南.md`：`errors.py`、`games/registry.py`、`common/scoring.py`、`games/demo_game/`、`auth/decorators.py`、`config.py`、`config.json` 字段约定

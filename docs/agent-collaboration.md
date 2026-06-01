# Agent Collaboration Guide

## Project Context

"我们的王牌" —— 中山职业技术学院 20 周年校庆扑克游戏平台。52 张扑克牌 + 大小王展示创业校友档案，带插件式小游戏 + 积分排行榜。

- **Backend**: Flask (Python 3.10+), SQLAlchemy, SQLite
- **Frontend**: React 18 + Vite 5 + Tailwind CSS 3, mobile-first
- **Database**: SQLite (`poker_dev.db` dev, `/data/poker/poker.db` prod)

## Conventions

### Entry Points
- Backend: `backend/app.py::create_app()` — factory pattern
- Frontend: `frontend/src/main.jsx` → `App.jsx`
- Frontend public game registration: `frontend/src/config/gameRegistry.js`
- Routing: `App.jsx` reads from `gameRegistry.js` (React Router v6)

### Key Rules (from AGENTS.md)
- Plugin hard rules: no touching `users`, `game_scores`, `daily_game_counts` tables
- No custom error code numbers
- No modifying `backend/app.py`, `errors.py`, `registry.py`, `common/scoring.py` except for specific allowed additions
- Response format: always HTTP 200, `{"code": 0/err, "message": str, "data": any}`

## Multi-Agent Workflow

### Before Starting Work
1. Read `docs/agent-collaboration.md` (this file)
2. Read `docs/agent-update-log.md` — check what was done and what's pending
3. Review recent `git log` for context
4. Check `AGENTS.md` for project conventions and commands

### Before Making Changes
- Verify which files are "forbidden" (see AGENTS.md plugin rules)
- Check all 3 of frontend + backend + docs might need updates
- For plugin work: only modify `backend/games/<id>/` directory

### Hazard Checklist
- [ ] Does this touch the database schema? → Flask-Migrate needed
- [ ] Does this add a public API endpoint? → Auth required?
- [ ] Does this change response format? → Must keep `{code, message, data}`
- [ ] Does this modify a forbidden file? → Rethink approach
- [ ] Does this need a startup script or config update?
- [ ] Are docs in `docs/` in sync with code changes?

### After Implementation
1. Update `docs/agent-update-log.md` with what changed
2. If a durable pattern was created, store it via memory-management skill
3. Verify the frontend builds (`npm run build` or `vite build`)

## 已有插件（2026-05-26 止）

| 插件 | 后端目录 | 前端页面 | 状态 |
|------|----------|----------|------|
| 蜘蛛纸牌 | `backend/games/spider_solitaire/` | `frontend/src/pages/SpiderSolitaire.jsx` | ✅ 正式公开 |
| 经典克朗代克 | `backend/games/klondike/` | `frontend/src/pages/Klondike.jsx` | ✅ 正式公开 |
| 空当接龙 | `backend/games/freecell/` | `frontend/src/pages/FreeCell.jsx` | ✅ 正式公开 |
| 金字塔纸牌 | `backend/games/pyramid/` | `frontend/src/pages/Pyramid.jsx` | ✅ 正式公开 |
| 三峰纸牌 | `backend/games/tripeaks/` | `frontend/src/pages/TriPeaks.jsx` | ✅ 正式公开 |
| 高尔夫纸牌 | `backend/games/golf/` | `frontend/src/pages/Golf.jsx` | ✅ 正式公开 |
| 时钟纸牌 | `backend/games/clock/` | `frontend/src/pages/Clock.jsx` | ✅ 正式公开 |
| demo | `backend/games/demo_game/` | 无前端页面 | 平台参考实现，不进公开列表 |

### 游戏接入边界
- 游戏玩法保持插件独立：后端逻辑放 `backend/games/<id>/`，前端玩法页面放对应 `frontend/src/pages/`
- 正式公开接入必须同步登记 `frontend/src/config/gameRegistry.js`
- `demo_game`、实验插件、参考插件默认不得进入 `/api/games` 公开列表

## Startup

```powershell
# 后端
cd backend
$env:FLASK_ENV='dev'; flask run

# 前端（另开终端）
cd frontend && npm run dev
```

## 开发登录

```js
// 打开 http://localhost:5173，F12 Console 执行：
// 管理员账号：13424514766 / ZSPT@wmdwp2026
localStorage.setItem('poker_access_token', '<从 admin-login 拿到的 token>')
```

或用 SMS 桩：调用 `/api/auth/send-code`，查看 Flask 日志中 `[SMS-STUB] code=XXXXXX`，再用验证码登录。

## Common Pitfalls
- Flask UTF-8 path issues on Windows → keep scripts ASCII-safe
- `.venv` activate path uses `.venv` not `venv`
- Vite proxy: `/api` → `http://localhost:5000`
- 开发测试会消耗每日游戏次数 → 清空 `daily_game_counts` 表即可恢复
- 后端始终返回 HTTP 200，业务结果看 JSON `code` 字段
- `/score` 同用户同游戏间隔 ≥ 10 秒，否则返回 `42903`

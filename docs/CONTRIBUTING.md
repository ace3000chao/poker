# 贡献指南

本项目采用 **GitHub Flow + Fork-and-PR** 协作模式:

- 唯一长生命周期分支:`main`(受保护,禁止直推)。
- 所有改动通过 **Pull Request** 合并;CI 通过 + 至少 1 个 reviewer approval 才能合。
- 测试服 `106.55.169.208` 跟踪 `main`;正式发布按 tag。

如果你是**第三方插件开发者**,先看完[《游戏插件开发指南》](docs/游戏插件开发指南.md),
再回到本文走流程。

---

## 一、分支命名

| 前缀 | 用途 | 示例 |
|---|---|---|
| `plugin/<game_id>` | 新插件或插件改动 | `plugin/card_guess`、`plugin/card_guess/anti-cheat` |
| `feat/<desc>` | 平台新功能 | `feat/admin-export` |
| `fix/<desc>` | 平台 Bug 修复 | `fix/score-race` |
| `docs/<desc>` | 仅文档改动 | `docs/plugin-guide-section-7` |

短横线分词,全英文小写。一个 PR 一个分支,合并即删除。

---

## 二、第三方插件开发者流程

### 准备:被邀请进仓库

仓库是 **Private**,你需要先被平台维护者邀请为 **Read collaborator**,才能 fork。
请把你的 GitHub 用户名发给维护者并等待邀请邮件,接受后即可进入下一步。

### 开发循环

```bash
# 1. Fork(在 GitHub 仓库页右上角)→ 然后 clone 你的 fork
git clone git@github.com:<your-handle>/poker.git
cd poker

# 2. 同步上游,新建插件分支
git remote add upstream git@github.com:<owner>/poker.git
git fetch upstream
git checkout -b plugin/my_game upstream/main

# 3. 按《游戏插件开发指南》在 backend/games/my_game/ 下加文件
#    只动这个目录(平台文件不要改)

# 4. 本地起服务跑通三路由(指南第 8 节)
cd backend
python3 -m flask db upgrade
FLASK_ENV=dev python3 -m flask run

# 5. commit + push 到你的 fork
git add backend/games/my_game/
git commit -m "plugin(my_game): 初版"
git push origin plugin/my_game

# 6. 在 GitHub 上对 upstream 的 main 开 PR,填好模板里的核对清单
```

### PR 必过门槛

- CI 全绿(目录沙盒 + 服务启动 + 三路由烟测)。
- CODEOWNERS 自动指派的 reviewer approve。
- 在 PR 描述里勾完插件 PR 核对清单。

合并后:

- 维护者会把 `CODEOWNERS` 里 `/backend/games/my_game/` 这一行的归属人改成你,
  之后**本插件的后续 PR** 会自动通知你 review。
- 测试服 pull 即生效;正式上架由管理员在后台开关。

---

## 三、平台开发者流程

平台维护者(有写权限的协作者)不用 fork,直接在主仓开分支:

```bash
git checkout main && git pull
git checkout -b feat/admin-export
# ... 改代码、写测试 ...
git push -u origin feat/admin-export
# 在 GitHub 开 PR
```

如果改动影响插件契约(`errors.py` / `registry.py` / `common/scoring.py` 等),
**必须同步更新**《游戏插件开发指南》并在其末尾"变更记录"加一行,这是 PR 模板里强制项。

---

## 四、Commit 信息约定

简明,前缀指明范围,中文 OK:

| 前缀 | 含义 |
|---|---|
| `plugin(<id>): ...` | 插件改动 |
| `feat: ...` | 平台新功能 |
| `fix: ...` | 平台 Bug 修复 |
| `docs: ...` | 文档 |
| `chore: ...` | 杂项(CI、配置、依赖) |

主 squash 合并保留 PR 标题作为最终 commit message,所以**PR 标题要按上面格式写**。

---

## 五、Issue

新建 issue 时从模板选:

- 🐞 **Bug 报告** —— 平台或插件有 Bug
- 🎮 **插件提案** —— 提议加一款新游戏
- ✨ **平台功能** —— 平台需要新能力支持你的玩法

---

## 六、不能做的事

- ❌ 直接 `git push origin main` —— main 受保护会被拒
- ❌ 在插件 PR 里改 `backend/app.py` / `errors.py` / `registry.py` / `common/scoring.py` 等平台文件 —— CI 会拦
- ❌ 自造全局错误码数字 —— 需要新错误码请开 issue 让平台在 `errors.py` 登记
- ❌ 跳过 PR 流程直接交付目录给维护者 —— 不再支持

<!-- PR 标题示例:
     plugin(card_guess): 初版
     feat: 管理后台导出积分 CSV
     fix: 修复 /score 竞态 -->

## 改动类型(单选)

- [ ] 🎮 插件改动(`plugin/<game_id>` 分支)
- [ ] ✨ 平台功能(`feat/...` 分支)
- [ ] 🐞 平台修复(`fix/...` 分支)
- [ ] 📝 仅文档(`docs/...` 分支)

## 改动内容

<!-- 一句话说清做了什么、为什么 -->

## 插件 PR 核对清单
> 平台 PR 跳过本节

- [ ] 目录名 == `config.json` 的 `id` == 代码里 `_GAME_KEY` 常量,三者一致
- [ ] `__init__.py` 暴露名为 `bp` 的 Flask Blueprint
- [ ] `/info` 公开(无 `@require_auth`),`/play` `/score` 加 `@require_auth`
- [ ] `/play` 调 `scoring.start_session`,`/score` 调 `scoring.submit_score`
- [ ] 没有直接读写 `users` / `game_scores` / `daily_game_counts` 表
- [ ] 没有改动 `backend/app.py` / `errors.py` / `registry.py` / `scoring.py` 等平台文件
- [ ] 本地三路由跑通(《游戏插件开发指南》第 8 节);贴一下烟测结果:

```
<!-- 粘贴 /info /play /score 三次 curl 的成功响应 -->
```

- [ ] CODEOWNERS 已加本插件归属行(`/backend/games/<id>/  @你的-github-handle`)

## 平台 PR 核对清单
> 插件 PR 跳过本节

- [ ] 改动了 `errors.py` / `registry.py` / `common/scoring.py` / `auth/decorators.py` / `config.py` / `games/demo_game/` 中任何文件 → 已同步更新《游戏插件开发指南》对应章节
- [ ] 若破坏插件契约(签名/字段/错误码语义变更):已在指南末尾"变更记录"追加一行 + bump 平台 major 版本
- [ ] CI 绿

## 相关 Issue

<!-- Closes #123 / Refs #456,没有就写"无" -->

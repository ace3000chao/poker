"""游戏插件目录。

每个子目录是一个游戏插件,需包含:
  __init__.py    暴露名为 `bp` 的 Flask Blueprint
  config.json    游戏配置(遵循《游戏插件接口规范》第二节)
  routes.py      实现 /info /play /score 三个标准路由
应用启动时由 games.registry.register_games() 自动发现并注册。
"""

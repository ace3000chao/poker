"""示例游戏插件:演示插件框架的标准接口契约。

正式内置游戏玩法待规划(开发启动清单 决策 #3),本插件仅用于
验证自动注册、config.json 加载与 /info /play /score 三路由。
"""
from .routes import bp

__all__ = ["bp"]

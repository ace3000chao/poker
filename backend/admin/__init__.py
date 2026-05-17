"""管理后台模块(全部接口 require_admin)。

  概览     GET  /api/admin/stats
  用户     GET  /api/admin/users           列表+搜索+分页
           GET  /api/admin/users/<id>      详情
           POST /api/admin/users/<id>/points  手动调整积分
  扑克牌   GET  /api/admin/cards            全部(含未公开)
           PUT  /api/admin/cards/<id>       编辑/分配花色点数/公开开关
  特殊牌   GET  /api/admin/special-cards
           PUT  /api/admin/special-cards/<type>   大王/小王内容
  游戏     GET  /api/admin/games
           POST /api/admin/games/<game_id>/toggle  上下架
"""

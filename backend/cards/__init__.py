"""扑克牌档案模块。

公开接口(无需登录,《用户角色与权限》:访客可完整查看):
  GET /api/cards            列表 + 搜索(姓名/公司/行业/花色)
  GET /api/cards/<key>      单张详情(id 或 card_key)
  GET /api/special-cards    大王/小王
"""

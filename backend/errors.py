"""全局唯一错误码表(Q1 决策:重建,分段唯一)。

分段:
  0       成功
  400xx   参数 / 业务错误
  401xx   认证错误(未登录 / Token 过期)
  403xx   权限错误
  404xx   资源不存在
  423xx   锁定
  429xx   限流
  500xx   服务器错误

统一响应:{"code": int, "message": str, "data": any}
"""
from flask import jsonify

# 成功
OK = 0

# 400xx 参数 / 业务
ERR_PARAM = 40001            # 参数格式错误
ERR_BUSINESS = 40002         # 业务逻辑错误(如 session 不匹配)
ERR_CODE_WRONG = 40003       # 验证码错误
ERR_CODE_EXPIRED = 40004     # 验证码已过期
ERR_CODE_USED = 40005        # 验证码已使用
ERR_CODE_PURPOSE = 40006     # 验证码用途不匹配
ERR_PASSWORD_WRONG = 40007       # 手机号或密码错误
ERR_PASSWORD_NOT_SET = 40008     # 该账号未设置密码
ERR_PASSWORD_WEAK = 40009        # 密码不符合复杂度要求
ERR_OLD_PASSWORD_WRONG = 40010   # 原密码错误

# 401xx 认证
ERR_UNAUTHORIZED = 40101     # 未登录或 Token 无效
ERR_TOKEN_EXPIRED = 40102    # Access Token 已过期
ERR_REFRESH_INVALID = 40103  # Refresh Token 无效或过期

# 403xx 权限
ERR_FORBIDDEN = 40301        # 无权限(非管理员等)
ERR_ACCOUNT_PENDING = 40302  # 账号待管理员审核通过

# 404xx 资源
ERR_GAME_NOT_FOUND = 40401   # 游戏不存在
ERR_GAME_OFFLINE = 40402     # 游戏已下架
ERR_CARD_NOT_FOUND = 40403   # 扑克牌不存在

# 423xx 锁定
ERR_ACCOUNT_LOCKED = 42301   # 账户已锁定(登录失败过多)

# 429xx 限流
ERR_SMS_TOO_FREQUENT = 42901  # 验证码发送太频繁
ERR_DAILY_LIMIT = 42902       # 今日游戏次数已用完
ERR_SCORE_TOO_FAST = 42903    # 成绩上报间隔太短

# 500xx 服务器
ERR_INTERNAL = 50001          # 服务器内部错误

MESSAGES = {
    OK: "success",
    ERR_PARAM: "参数格式错误",
    ERR_PASSWORD_WRONG: "手机号或密码错误",
    ERR_PASSWORD_NOT_SET: "该账号未设置密码,请用验证码登录后设置",
    ERR_PASSWORD_WEAK: "密码至少 8 位,且需同时包含字母和数字",
    ERR_OLD_PASSWORD_WRONG: "原密码错误",
    ERR_BUSINESS: "业务逻辑错误",
    ERR_CODE_WRONG: "验证码错误",
    ERR_CODE_EXPIRED: "验证码已过期",
    ERR_CODE_USED: "验证码已使用",
    ERR_CODE_PURPOSE: "验证码用途不匹配",
    ERR_UNAUTHORIZED: "未登录或 Token 无效",
    ERR_TOKEN_EXPIRED: "Token 已过期",
    ERR_REFRESH_INVALID: "Refresh Token 无效或已过期",
    ERR_FORBIDDEN: "无访问权限",
    ERR_ACCOUNT_PENDING: "账号待审核,管理员通过后即可使用",
    ERR_GAME_NOT_FOUND: "游戏不存在",
    ERR_GAME_OFFLINE: "游戏已下架",
    ERR_CARD_NOT_FOUND: "扑克牌不存在",
    ERR_ACCOUNT_LOCKED: "账户已锁定,请稍后再试",
    ERR_SMS_TOO_FREQUENT: "发送太频繁,请稍后再试",
    ERR_DAILY_LIMIT: "今日游戏次数已用完",
    ERR_SCORE_TOO_FAST: "成绩上报间隔太短",
    ERR_INTERNAL: "服务器内部错误",
}


def api_response(code=OK, data=None, message=None, http_status=200):
    """统一 API 响应封装。"""
    body = {
        "code": code,
        "message": message or MESSAGES.get(code, "unknown"),
        "data": data,
    }
    return jsonify(body), http_status


def ok(data=None):
    return api_response(OK, data)


def fail(code, message=None, http_status=200):
    return api_response(code, None, message, http_status)

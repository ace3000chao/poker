"""短信验证码工具(桩实现)。

正式短信服务商待确认(开发启动清单 前置依赖 #4)。当前为开发桩:
- 生成 6 位数字验证码
- send_sms() 仅打印到日志,不真实下发
对接真实服务商时只需替换 send_sms() 内部实现。
"""
import random

from flask import current_app


def generate_code(length=6):
    return "".join(random.choices("0123456789", k=length))


def send_sms(phone, code, purpose):
    """开发桩:打印到日志。生产环境替换为真实短信网关调用。"""
    current_app.logger.info(
        "[SMS-STUB] phone=%s purpose=%s code=%s (未真实下发,待接入短信服务商)",
        phone, purpose, code,
    )
    return True

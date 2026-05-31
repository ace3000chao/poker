"""图片上传保存(扑克牌图 / 用户头像通用)。"""
import os
import time
import uuid

from flask import current_app
from werkzeug.utils import secure_filename


def save_image(file_storage):
    """校验并保存上传图片,返回可访问 URL(/api/uploads/<name>)。

    失败抛 ValueError(消息由路由转成 ERR_PARAM 响应)。
    文件名服务器自生成(时间戳 + uuid),避免穿越/覆盖;扩展名按白名单校验。
    """
    if file_storage is None or not file_storage.filename:
        raise ValueError("未收到文件(字段名 file)")
    fn = file_storage.filename
    ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else ""
    if ext not in current_app.config["ALLOWED_IMG_EXT"]:
        raise ValueError("仅支持 png/jpg/jpeg/webp/gif")
    upload_dir = current_app.config["UPLOAD_DIR"]
    os.makedirs(upload_dir, exist_ok=True)
    name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
    file_storage.save(os.path.join(upload_dir, secure_filename(name)))
    return f"/api/uploads/{name}"

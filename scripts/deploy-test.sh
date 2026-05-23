#!/usr/bin/env bash
# 测试服一键部署。
#
# 把 106.55.169.208 上的代码同步到 origin/main 最新,跑迁移,重启后端。
#
# 用法:在本地仓库根目录执行
#   ./scripts/deploy-test.sh
#
# 前置:
#   1. 本机 ssh root@106.55.169.208 已配好(免密或 ssh-agent)。
#   2. 测试服已经 git clone 过本仓到 $DEPLOY_PATH,且 venv 已创建。
#   3. systemd 或 supervisor 已配好 $SERVICE_NAME 服务。
#
# 首次部署时,这三个参数按测试服实际填写,以后无需再改。
set -euo pipefail

SERVER="${POKER_DEPLOY_SERVER:-root@106.55.169.208}"
DEPLOY_PATH="${POKER_DEPLOY_PATH:-/www/wwwroot/poker}"   # TODO: 改为测试服实际路径
SERVICE_NAME="${POKER_SERVICE_NAME:-poker-backend}"      # TODO: 改为实际服务名

echo "→ 部署到 $SERVER:$DEPLOY_PATH (服务 $SERVICE_NAME)"

ssh "$SERVER" DEPLOY_PATH="$DEPLOY_PATH" SERVICE_NAME="$SERVICE_NAME" bash -se <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_PATH"

echo "→ 拉取 origin/main"
git fetch origin main
git reset --hard origin/main

echo "→ 安装依赖 + 迁移"
cd backend
source .venv/bin/activate
pip install -q -r requirements.txt
FLASK_ENV=prod flask db upgrade

echo "→ 重启服务"
if systemctl --quiet is-active "$SERVICE_NAME" 2>/dev/null; then
  systemctl restart "$SERVICE_NAME"
elif command -v supervisorctl >/dev/null 2>&1; then
  supervisorctl restart "$SERVICE_NAME"
else
  echo "⚠️  未找到 systemctl 或 supervisorctl,请手动重启 $SERVICE_NAME"
fi

echo "✓ 已部署到 $(git rev-parse --short HEAD)"
REMOTE

echo "→ 健康检查"
curl -sf "http://106.55.169.208/api/health" && echo "" || echo "⚠️ 健康检查失败,请到服务器看日志"

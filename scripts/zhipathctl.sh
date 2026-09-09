#!/usr/bin/env bash
set -Eeuo pipefail

# ZhiPath 本机运行控制台：统一管理中间件、后端、Nginx 和 Cloudflare Tunnel。
# 前端是 Nginx 托管的静态文件，没有单独的常驻进程。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE" -p middleware)

usage() {
  cat <<'EOF'
用法：
  ./scripts/zhipathctl.sh start                 启动生产服务（中间件、后端、Nginx、隧道）
  ./scripts/zhipathctl.sh stop                  停止项目服务（保留数据库数据卷）
  ./scripts/zhipathctl.sh restart               重启项目服务
  ./scripts/zhipathctl.sh status                查看服务和 API 健康状态
  ./scripts/zhipathctl.sh logs [backend|tunnel|middleware|nginx]
                                                 跟随指定服务日志（默认 backend）
  ./scripts/zhipathctl.sh dev                   前台启动三路开发服务，Ctrl+C 一键停止

说明：stop 不会停止 Nginx，避免影响同机其他站点；也不会删除 Docker 数据卷。
EOF
}

has_unit() {
  systemctl cat "$1" >/dev/null 2>&1
}

unit_action() {
  local action="$1" unit="$2"
  if has_unit "$unit"; then
    sudo systemctl "$action" "$unit"
  else
    echo "[skip] 未安装 $unit"
  fi
}

start() {
  echo "[start] middleware"
  "${COMPOSE[@]}" --profile core up -d
  unit_action start zhipath-backend.service
  unit_action start nginx.service
  unit_action start zhipath-cloudflared.service
  status
}

stop() {
  # 先停止入口和后端，再停止依赖服务；数据卷保持不动。
  unit_action stop zhipath-cloudflared.service
  unit_action stop zhipath-backend.service
  echo "[stop] middleware"
  "${COMPOSE[@]}" --profile core stop
  echo "[ok] 项目服务已停止（Nginx 保持运行）"
}

status() {
  echo '== systemd =='
  for unit in zhipath-backend.service zhipath-cloudflared.service nginx.service; do
    if has_unit "$unit"; then
      printf '%-30s %s\n' "$unit" "$(systemctl is-active "$unit" 2>/dev/null || true)"
    else
      printf '%-30s %s\n' "$unit" 'not-installed'
    fi
  done
  echo '== middleware =='
  "${COMPOSE[@]}" --profile core ps
  echo '== api =='
  if curl -fsS --max-time 5 http://127.0.0.1:3000/api/v1/health/live >/dev/null; then
    echo 'backend live:      ok'
  else
    echo 'backend live:      failed'
  fi
  if curl -fsS --max-time 5 http://127.0.0.1:3000/api/v1/health/ready >/dev/null; then
    echo 'backend ready:     ok'
  else
    echo 'backend ready:     failed (检查 MySQL 或后端日志)'
  fi
}

logs() {
  case "${1:-backend}" in
    backend) sudo journalctl -u zhipath-backend.service -n 100 -f ;;
    tunnel|cloudflared) sudo journalctl -u zhipath-cloudflared.service -n 100 -f ;;
    middleware) "${COMPOSE[@]}" logs --tail=100 -f ;;
    nginx) sudo journalctl -u nginx.service -n 100 -f ;;
    *) echo "未知日志目标：$1" >&2; usage; return 2 ;;
  esac
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) logs "${2:-backend}" ;;
  dev) exec "$ROOT_DIR/scripts/dev-all.sh" ;;
  -h|--help|help) usage ;;
  *) usage; exit 2 ;;
esac

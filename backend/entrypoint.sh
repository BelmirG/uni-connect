#!/bin/bash
set -e

echo "==> Running database migrations..."
alembic upgrade head

# Railway and other managed hosts inject $PORT; local Docker defaults to 8000.
PORT="${PORT:-8000}"

# RELOAD=1 enables uvicorn hot-reload for local development (set in docker-compose).
# Production leaves it unset — reload watches the filesystem and must never run live.
RELOAD_FLAG=""
if [ "${RELOAD:-0}" = "1" ]; then
  RELOAD_FLAG="--reload"
fi

echo "==> Starting FastAPI server on port ${PORT} (reload=${RELOAD:-0})..."
# --proxy-headers makes uvicorn take the real client IP from X-Forwarded-For.
# Behind Railway (or any managed host) the direct peer is always the platform's
# proxy, so without this every user shares one IP — and one rate-limit bucket,
# meaning five friends registering would lock out everyone else for an hour.
# Trusting "*" is safe here because only the platform proxy can reach the container.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" ${RELOAD_FLAG} \
  --proxy-headers --forwarded-allow-ips="*" \
  --timeout-graceful-shutdown 3

#!/usr/bin/env bash
set -euo pipefail

# Simple deploy script for AnChat
# - Expects apps/server/.env to exist on the target machine (secrets not managed here)

ROOT_DIR=${ROOT_DIR:-$(pwd)}
APP_DIR=${APP_DIR:-$ROOT_DIR}

echo "[1/5] Installing dependencies (workspaces)"
cd "$APP_DIR"
# Повне очищення перед інсталяцією, щоб уникнути EEXIST symlink
rm -rf node_modules || true
mkdir -p node_modules
rm -f node_modules/server node_modules/web || true
npm cache clean --force || true
npm ci || {
  echo "npm ci failed, cleaning and retrying...";
  rm -rf node_modules || true;
  npm ci;
}

echo "[1.9/5] Clean Next.js cache (before build)"
rm -rf "$APP_DIR/apps/web/.next" || true

echo "[2/5] Building workspaces"
if ! npm run build --workspaces; then
  echo "[2/5] Build failed — retrying web without Turbopack"
  npm --workspace apps/web run build:compat
fi

echo "[2.5/5] Generate Prisma client"
cd "$APP_DIR/apps/server"
npx prisma generate || true
cd "$APP_DIR"

echo "[3/5] Starting/Reloading PM2 apps"
if pm2 ping >/dev/null 2>&1; then
  :
else
  pm2 resurrect || true
fi

if pm2 ls | grep -q anchat-api; then
  pm2 reload ecosystem.config.cjs --only anchat-api --update-env || pm2 start ecosystem.config.cjs --only anchat-api
else
  pm2 start ecosystem.config.cjs --only anchat-api
fi

if pm2 ls | grep -q anchat-web; then
  pm2 reload ecosystem.config.cjs --only anchat-web --update-env || pm2 start ecosystem.config.cjs --only anchat-web
else
  pm2 start ecosystem.config.cjs --only anchat-web
fi

pm2 save

echo "[4/5] Health checks"
set +e
curl -sS -i http://127.0.0.1:4000/ | head -n 1 || true
curl -sS -I http://127.0.0.1:3000/ | head -n 1 || true
set -e

echo "[5/5] Done"



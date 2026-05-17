#!/usr/bin/env bash
set -e

export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 24.13.0
fi

export PATH="/home/ubuntu/.nvm/versions/node/v24.13.0/bin:$PATH"

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

set -euo pipefail

APP_DIR="/home/ubuntu/DeveloperModeAdmin"
BUILD_DIR="dist"
NGINX_ROOT="/var/www/develop-mode-admin"
BRANCH="main"

echo "==> Starting deploy"
cd "$APP_DIR"

echo "==> Fetching latest code from main"
git fetch origin main

echo "==> Resetting local files to origin/main"
git reset --hard origin/main

echo "==> Removing untracked files"
git clean -fd

echo "==> Installing dependencies"
npm install

echo "==> Building app"
npm run build

echo "==> Ensuring nginx root exists"
sudo mkdir -p "$NGINX_ROOT"

echo "==> Clearing old deployed files"
sudo rm -rf "${NGINX_ROOT:?}/"*

echo "==> Copying new build files"
sudo cp -R "$BUILD_DIR"/. "$NGINX_ROOT"/

echo "==> Fixing ownership and permissions"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo find "$NGINX_ROOT" -type d -exec chmod 755 {} \;
sudo find "$NGINX_ROOT" -type f -exec chmod 644 {} \;

echo "==> Testing nginx config"
sudo nginx -t

echo "==> Restarting nginx"
sudo systemctl restart nginx

echo "==> Deploy complete"
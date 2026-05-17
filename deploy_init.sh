#!/usr/bin/env bash
set -euo pipefail

DOMAIN="tasks.freeradicalsproduction.com"
NGINX_ROOT="/var/www/develop-mode-admin"
NGINX_SITE="develop-mode-admin"
EMAIL="admin@freeradicalsproduction.com"

echo "==> Installing nginx + certbot"
sudo apt update
sudo apt install -y nginx certbot

echo "==> Creating web root"
sudo mkdir -p "$NGINX_ROOT"
sudo chown -R www-data:www-data "$NGINX_ROOT"

echo "==> Creating temporary index page"
echo "<h1>$DOMAIN is ready</h1>" | sudo tee "$NGINX_ROOT/index.html" >/dev/null

echo "==> Creating temporary HTTP nginx config for Certbot"
sudo tee "/etc/nginx/sites-available/$NGINX_SITE" >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $NGINX_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /.well-known/acme-challenge/ {
        root $NGINX_ROOT;
    }
}
EOF

echo "==> Enabling nginx site"
sudo ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"

echo "==> Removing default nginx site"
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Testing nginx config"
sudo nginx -t

echo "==> Reloading nginx"
sudo systemctl reload nginx

echo "==> Requesting HTTPS certificate using webroot"
sudo certbot certonly --webroot \
  -w "$NGINX_ROOT" \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL"

echo "==> Writing final HTTPS nginx config"
sudo tee "/etc/nginx/sites-available/$NGINX_SITE" >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root $NGINX_ROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    root $NGINX_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        access_log off;
        try_files \$uri =404;
    }
}
EOF

echo "==> Testing final nginx config"
sudo nginx -t

echo "==> Reloading nginx"
sudo systemctl reload nginx

echo "==> Testing certificate renewal"
sudo certbot renew --dry-run

echo "==> Init complete"
echo "You can now run your normal deploy script."
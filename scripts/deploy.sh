#!/bin/bash
# deploy.sh — Run this on your Ubuntu server to set up the full stack.
# Usage: bash deploy.sh yourdomain.com
# Prerequisites: Ubuntu 22.04+, a domain pointed at this server's IP

set -e
DOMAIN=${1:-"yourdomain.com"}

echo "==> [1/6] Installing Docker..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt-get install -y docker-compose-plugin

echo "==> [2/6] Installing Nginx + Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> [3/6] Cloning/updating repo..."
if [ -d "/opt/chatserver" ]; then
  cd /opt/chatserver && git pull
else
  git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /opt/chatserver
fi

echo "==> [4/6] Checking .env file..."
if [ ! -f "/opt/chatserver/chat-server/.env" ]; then
  cp /opt/chatserver/chat-server/.env.example /opt/chatserver/chat-server/.env
  echo ""
  echo "  !! IMPORTANT: Fill in your secrets in /opt/chatserver/chat-server/.env"
  echo "  !! Then re-run this script."
  echo ""
  exit 1
fi

echo "==> [5/6] Building and starting Docker containers..."
cd /opt/chatserver/chat-server
docker compose -f docker-compose.prod.yml up -d --build

echo "==> [6/6] Setting up Nginx and SSL..."
# Copy Nginx config
sudo cp /opt/chatserver/scripts/nginx.conf /etc/nginx/sites-available/chatapp
# Replace domain placeholder
sudo sed -i "s/yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/chatapp
# Enable site
sudo ln -sf /etc/nginx/sites-available/chatapp /etc/nginx/sites-enabled/chatapp
# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default
# Test config
sudo nginx -t
# Reload nginx (HTTP only first, so certbot can verify)
sudo systemctl reload nginx
# Get SSL cert
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN
# Final reload with SSL
sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo "  Your app is live at: https://$DOMAIN"
echo "=========================================="

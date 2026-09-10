#!/usr/bin/env bash
# Runs on the Azure VM after git pull.
# Called by GitHub Actions — restarts all Jarvis services.
set -e

JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Deploying from $JARVIS_DIR"

# ── Python brain ─────────────────────────────────────────────────────────────
echo "==> Installing Python deps..."
cd "$JARVIS_DIR/src/brain"
VENV="$JARVIS_DIR/.venv"
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r requirements.txt

echo "==> Restarting brain service..."
sudo systemctl restart jarvis-brain

# ── Go sidecar ───────────────────────────────────────────────────────────────
echo "==> Building Go sidecar..."
cd "$JARVIS_DIR/src/sidecar"
go build -o sidecar ./...

echo "==> Restarting sidecar service..."
sudo systemctl restart jarvis-sidecar

# ── Node.js gateway ──────────────────────────────────────────────────────────
echo "==> Installing gateway deps..."
cd "$JARVIS_DIR/src/gateway"
npm ci --silent
npm run build

echo "==> Restarting gateway service..."
sudo systemctl restart jarvis-gateway

# ── Next.js website ──────────────────────────────────────────────────────────
echo "==> Building website..."
cd "$JARVIS_DIR/src/website"
npm install --legacy-peer-deps --silent
npm run build
# standalone mode: copy static assets so nginx can serve them directly
cp -r .next/static .next/standalone/.next/static
# allow nginx (www-data) to read static files
chmod -R o+rX .next/standalone/.next/static/
# grant www-data traverse access using ACLs
command -v setfacl >/dev/null 2>&1 || { echo 'ERROR: setfacl not found; run: apt install acl' >&2; exit 1; }
setfacl -m u:www-data:x /home/rootuser
setfacl -m u:www-data:x "$JARVIS_DIR"

echo "==> Restarting website service..."
sudo systemctl restart jarvis-website

# ── nginx config ─────────────────────────────────────────────────────────────
echo "==> Updating nginx config..."
DOMAIN=$(grep NEXT_PUBLIC_GATEWAY_URL "$JARVIS_DIR/src/website/.env.local" 2>/dev/null \
    | grep -oP '(?<=://)[^/]+' | head -1)
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -v README | head -1)
fi
if [ -n "$DOMAIN" ]; then
    sed "s/DOMAIN/$DOMAIN/g" "$JARVIS_DIR/deploy/nginx-jarvis.conf" \
        | sudo tee /etc/nginx/sites-available/jarvis > /dev/null
    sudo ln -sf /etc/nginx/sites-available/jarvis /etc/nginx/sites-enabled/jarvis
    sudo nginx -t && sudo systemctl reload nginx
    echo "==> nginx reloaded for $DOMAIN"
    # Patch NEXT_PUBLIC_BRAIN_URL to include /brain path if it's still bare domain
    ENV_FILE="$JARVIS_DIR/src/website/.env.local"
    if [ -f "$ENV_FILE" ] && grep -q "^NEXT_PUBLIC_BRAIN_URL=" "$ENV_FILE"; then
        if ! grep -q "^NEXT_PUBLIC_BRAIN_URL=.*/brain" "$ENV_FILE"; then
            sed -i "s~^NEXT_PUBLIC_BRAIN_URL=https://\([^/]*\)\$~NEXT_PUBLIC_BRAIN_URL=https://\1/brain~" "$ENV_FILE"
            echo "==> Patched NEXT_PUBLIC_BRAIN_URL to include /brain"
        fi
    fi
else
    echo "WARN: could not detect domain, skipping nginx update"
fi

echo "==> Deploy complete. Services status:"
sudo systemctl is-active jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website || true

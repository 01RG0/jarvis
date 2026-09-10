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

echo "==> Deploy complete. Services status:"
sudo systemctl is-active jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website || true

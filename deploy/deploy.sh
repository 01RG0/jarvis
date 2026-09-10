#!/usr/bin/env bash
# Runs on the Azure VM after git pull.
# Called by GitHub Actions — restarts all Jarvis services.
set -e

JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Deploying from $JARVIS_DIR"

# ── Python brain ─────────────────────────────────────────────────────────────
echo "==> Installing Python deps..."
cd "$JARVIS_DIR/src/brain"
pip install -q -r requirements.txt

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
npm ci --prefer-offline --silent

echo "==> Restarting gateway service..."
sudo systemctl restart jarvis-gateway

# ── Next.js website ──────────────────────────────────────────────────────────
echo "==> Building website..."
cd "$JARVIS_DIR/src/website"
npm ci --prefer-offline --silent
npm run build

echo "==> Restarting website service..."
sudo systemctl restart jarvis-website

echo "==> Deploy complete. Services status:"
sudo systemctl is-active jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website || true

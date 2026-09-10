#!/usr/bin/env bash
# One-time setup on the Azure VM.
# Run as the VM user (not root): bash deploy/setup-vm.sh
set -e

USER_HOME="$HOME"
JARVIS_DIR="$USER_HOME/jarvis"
USERNAME="$(whoami)"

echo "==> Setting up JARVIS on Azure VM for user: $USERNAME"

# ── System deps ──────────────────────────────────────────────────────────────
sudo apt-get update -qq
sudo apt-get install -y -qq python3-pip python3-venv nodejs npm golang-go git

# Node >= 20 via NodeSource if current version is too old
node_ver=$(node --version 2>/dev/null | grep -oP '\d+' | head -1 || echo 0)
if [ "$node_ver" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Go >= 1.22
go_ver=$(go version 2>/dev/null | grep -oP '1\.\d+' | head -1 || echo "1.0")
if [ "$(echo "$go_ver 1.22" | awk '{print ($1 < $2)}')" = "1" ]; then
    wget -qO /tmp/go.tar.gz https://go.dev/dl/go1.22.4.linux-amd64.tar.gz
    sudo tar -C /usr/local -xzf /tmp/go.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    export PATH=$PATH:/usr/local/go/bin
fi

# ── Clone / set remote ───────────────────────────────────────────────────────
if [ ! -d "$JARVIS_DIR/.git" ]; then
    echo "==> Clone your repo:"
    echo "    git clone https://github.com/<YOUR_USER>/jarvis.git $JARVIS_DIR"
    echo "    Then re-run this script."
    exit 1
fi

# ── Python virtualenv ─────────────────────────────────────────────────────────
cd "$JARVIS_DIR/src/brain"
python3 -m venv "$JARVIS_DIR/.venv"
source "$JARVIS_DIR/.venv/bin/activate"
pip install -q -r requirements.txt
playwright install chromium --with-deps

# ── Go sidecar ───────────────────────────────────────────────────────────────
cd "$JARVIS_DIR/src/sidecar"
go mod tidy
go build -o sidecar ./...

# ── Node gateway ─────────────────────────────────────────────────────────────
cd "$JARVIS_DIR/src/gateway"
npm ci --silent

# ── Next.js website ──────────────────────────────────────────────────────────
cd "$JARVIS_DIR/src/website"
npm ci --silent
npm run build

# ── Systemd services ─────────────────────────────────────────────────────────
echo "==> Installing systemd services..."

for svc in brain sidecar gateway website; do
    tmp=$(mktemp)
    sed "s/%i/$USERNAME/g" "$JARVIS_DIR/deploy/jarvis-${svc}.service" > "$tmp"
    sudo cp "$tmp" "/etc/systemd/system/jarvis-${svc}.service"
    rm "$tmp"
done

# Give user passwordless sudo for service restarts (deploy only)
SUDOERS_LINE="$USERNAME ALL=(ALL) NOPASSWD: /bin/systemctl restart jarvis-brain, /bin/systemctl restart jarvis-sidecar, /bin/systemctl restart jarvis-gateway, /bin/systemctl restart jarvis-website, /bin/systemctl restart jarvis-voice, /bin/systemctl is-active jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website jarvis-voice, /bin/systemctl reload nginx, /usr/sbin/nginx, /usr/bin/tee /etc/nginx/sites-available/jarvis, /usr/bin/ln -sf /etc/nginx/sites-available/jarvis /etc/nginx/sites-enabled/jarvis"
echo "$SUDOERS_LINE" | sudo tee /etc/sudoers.d/jarvis-deploy > /dev/null
sudo chmod 440 /etc/sudoers.d/jarvis-deploy

sudo systemctl daemon-reload
sudo systemctl enable jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website
sudo systemctl start  jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website

echo ""
echo "==> Done! Services running:"
sudo systemctl is-active jarvis-brain jarvis-sidecar jarvis-gateway jarvis-website

echo ""
echo "==> Next: add these GitHub Secrets to your repo:"
echo "    AZURE_VM_HOST  = $(curl -s ifconfig.me)"
echo "    AZURE_VM_USER  = $USERNAME"
echo "    AZURE_SSH_KEY  = (contents of ~/.ssh/id_ed25519 — generate with: ssh-keygen -t ed25519)"
echo ""
echo "    Add the PUBLIC key to ~/.ssh/authorized_keys on this VM:"
echo "    cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys"

# Jarvis — Development Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Recommend [uv](https://github.com/astral-sh/uv) for env management |
| Go | 1.22+ | For building the watchdog binary |
| Node.js | 20 LTS | Gateway and website |
| Docker | optional | For LiteLLM proxy mode (not needed for v1 SDK mode) |

---

## Azure VM Setup

**Recommended VM:** Ubuntu 22.04 LTS, Standard B2ms (2 vCPU / 8 GB RAM)

```bash
# System dependencies
sudo apt update && sudo apt install -y \
  build-essential python3-dev portaudio19-dev \
  libsqlite3-dev libssl-dev curl git

# Go (if not installed)
curl -OL https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# uv (Python env manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Open ports** (Azure Network Security Group):
- 443 (HTTPS)
- 80 (HTTP → 443 redirect)
- 8080 (Gateway WebSocket — restrict to your IP in production)
- 3000 (Next.js dev only — remove in production)

---

## Repository Setup

```bash
git clone <your-repo-url> jarvis
cd jarvis
cp .env.example .env
# Fill in API keys in .env
```

---

## Python Brain Setup

```bash
cd src/brain

# Create virtual env with uv
uv venv .venv
source .venv/bin/activate

# Install dependencies
uv pip install \
  langgraph \
  litellm \
  mem0ai \
  "mem0ai[vector]" \
  sqlite-vec \
  pydantic \
  python-dotenv \
  httpx
```

---

## Go Watchdog Build

```bash
cd src/watchdog

# Build static binary
CGO_ENABLED=0 GOOS=linux go build -o jarvis-watchdog .

# Verify
./jarvis-watchdog --version
```

---

## Node Gateway Setup

```bash
cd src/gateway
npm install
npm run build        # TypeScript compile
```

---

## Website Setup

```bash
cd src/website
npm install
npm run build        # Production build
# or: npm run dev   # Dev server on :3000
```

---

## Voice Pipeline Setup

```bash
cd src/voice

source ../brain/.venv/bin/activate   # reuse brain's venv

uv pip install \
  "pipecat-ai[deepgram,elevenlabs,silero]" \
  openwakeword \
  pyaudio

# Download openWakeWord pretrained models
python -c "import openwakeword; openwakeword.utils.download_models()"
```

---

## LiteLLM Configuration

Jarvis uses LiteLLM in **SDK mode** (in-process, no Docker) for v1. Configure providers in `src/brain/config/litellm_config.yaml`:

```yaml
model_list:
  - model_name: fast
    litellm_params:
      model: groq/llama3-8b-8192
      api_key: ${GROQ_API_KEY}

  - model_name: balanced
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: ${ANTHROPIC_API_KEY}

  - model_name: smart
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: ${ANTHROPIC_API_KEY}

router_settings:
  routing_strategy: least-busy
  fallbacks:
    - { smart: [balanced, fast] }
    - { balanced: [fast] }
```

---

## systemd Service Files

**Watchdog** (`/etc/systemd/system/jarvis-watchdog.service`):

```ini
[Unit]
Description=Jarvis Watchdog
After=network.target

[Service]
Type=simple
User=jarvis
WorkingDirectory=/home/jarvis/jarvis
ExecStart=/home/jarvis/jarvis/src/watchdog/jarvis-watchdog
Restart=always
RestartSec=3
MemoryMax=64M
CPUQuota=10%
EnvironmentFile=/home/jarvis/jarvis/.env

[Install]
WantedBy=multi-user.target
```

**Gateway** (`/etc/systemd/system/jarvis-gateway.service`):

```ini
[Unit]
Description=Jarvis Gateway
After=network.target jarvis-watchdog.service

[Service]
Type=simple
User=jarvis
WorkingDirectory=/home/jarvis/jarvis/src/gateway
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
MemoryMax=200M
CPUQuota=25%
EnvironmentFile=/home/jarvis/jarvis/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jarvis-watchdog jarvis-gateway
```

---

## Startup Order

1. **Watchdog** — starts first (systemd, always-on)
2. **Gateway** — starts second (systemd, always-on)
3. **Brain** — starts on-demand when a task arrives (watchdog supervises)
4. **Voice pipeline** — starts when a voice session is requested (on-demand)

---

## Health Check

```bash
# Gateway health
curl http://localhost:8080/health

# Watchdog status
systemctl status jarvis-watchdog

# View logs
journalctl -u jarvis-gateway -f
journalctl -u jarvis-watchdog -f
```

---

## PC Worker Setup

On your home PC, register it as a burst-work worker:

```bash
# Install dependencies (same Python + CLIs as the Azure VM)
# Then:
cd jarvis
cp .env.example .env
# Set AZURE_VM_HOST and WORKER_* vars in .env

python src/dispatcher/worker_register.py
```

The PC worker will send heartbeats to `WORKER_AZURE_ENDPOINT` on the interval defined in `.env`. The Azure brain will dispatch heavy tasks to it when it's registered.

---

## Directory Layout for Data

```bash
mkdir -p data/{db,logs,task-workdirs}
```

```
data/
├── jarvis.db          # Main SQLite database (memory, task log, cost tracking)
├── logs/              # Brain, gateway, voice logs
└── task-workdirs/     # Isolated working dirs per dispatched task
```

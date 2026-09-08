# Research: LiteLLM

**Verdict: Use it. SDK mode for v1, proxy mode later if needed.**

## What it is

LiteLLM is a Python library + optional standalone proxy that puts a single OpenAI-compatible
interface in front of 100+ LLM providers (Anthropic, OpenAI, Google, Groq, Bedrock, Ollama,
OpenRouter, etc.). You call `litellm.completion(model="anthropic/claude-sonnet-5", ...)` and
it handles auth, request translation, and response normalization.

The `Router` class adds: model fallbacks, retry logic, load balancing, and per-call cost
tracking via callbacks.

## SDK Mode Setup (v1)

```python
import litellm
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "fast",
            "litellm_params": {
                "model": "groq/llama3-8b-8192",
                "api_key": os.environ["GROQ_API_KEY"],
            },
        },
        {
            "model_name": "balanced",
            "litellm_params": {
                "model": "anthropic/claude-haiku-4-5-20251001",
                "api_key": os.environ["ANTHROPIC_API_KEY"],
            },
        },
        {
            "model_name": "smart",
            "litellm_params": {
                "model": "anthropic/claude-sonnet-5",
                "api_key": os.environ["ANTHROPIC_API_KEY"],
            },
        },
    ],
    fallbacks=[
        {"smart": ["balanced", "fast"]},
        {"balanced": ["fast"]},
    ],
    allowed_fails=2,
    cooldown_time=60,  # seconds before a failed provider is retried
)

# Usage
response = router.completion(
    model="smart",
    messages=[{"role": "user", "content": "plan this task"}],
)
```

## Cost Tracking via Callback

```python
import litellm

def log_cost(kwargs, completion_response, start_time, end_time):
    cost = litellm.completion_cost(completion_response=completion_response)
    # write to SQLite: model, cost, tokens, timestamp
    ...

litellm.success_callback = [log_cost]
```

## Proxy Mode (future)

When you want the admin dashboard, virtual keys, and a shared gateway:

```bash
docker run -d \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -p 4000:4000 \
  ghcr.io/berriai/litellm:main-latest \
  --config /app/config.yaml --port 4000 --num_workers 1
```

The proxy exposes an OpenAI-compatible endpoint at `localhost:4000`. Other processes (Go watchdog, PC worker) can call it with just `OPENAI_API_KEY=<virtual-key> OPENAI_BASE_URL=http://localhost:4000`.

## Gotchas

- `LITELLM_DROP_PARAMS=true` — prevents errors when passing parameters that a provider doesn't support (e.g. `top_p` to some providers)
- `LITELLM_LOG=WARNING` — the default INFO level is very noisy; set to WARNING in production
- Per-provider rate limits: LiteLLM's Router handles 429s automatically but you need to configure `allowed_fails` and `cooldown_time` to tune the retry behavior
- `litellm.completion_cost()` requires the completion response object (not just the text) — pass `completion_response` not `response.choices[0].message.content`

## Resources

- Docs: https://docs.litellm.ai
- GitHub: https://github.com/BerriAI/litellm
- Docker image: https://github.com/hwdsl2/docker-litellm

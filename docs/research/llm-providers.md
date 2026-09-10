# JARVIS LLM Provider Management — Research & Reference

> Current stack: Groq (llama-3.1-8b-instant) + Gemini (gemini-1.5-flash) via LiteLLM.
> No Anthropic key yet. No local inference. This doc covers expanding to all providers
> and building a robust routing/fallback/cost-tracking system.

---

## 1. Provider Comparison

| Provider | Best model | Context | Speed (tok/s) | Cost/1M in | Tool calling | Vision | Streaming |
|---|---|---|---|---|---|---|---|
| **Groq** | llama-3.3-70b | 128K | 300–800 | ~$0.59 | ✅ | ❌ | ✅ |
| **Google Gemini** | gemini-1.5-pro | 2M | 60–120 | $3.50 | ✅ | ✅ | ✅ |
| **Gemini Flash** | gemini-1.5-flash | 1M | 100–200 | $0.075 | ✅ | ✅ | ✅ |
| **DeepSeek** | deepseek-v3 | 64K | 40–80 | $0.14 | ✅ | ❌ | ✅ |
| **DeepSeek-R1** | deepseek-r1 | 64K | 20–40 | $0.55 | ❌ | ❌ | ✅ |
| **OpenAI** | gpt-4o-mini | 128K | 80–150 | $0.15 | ✅ | ✅ | ✅ |
| **Anthropic** | claude-sonnet-5 | 200K | 60–100 | $3.00 | ✅ | ✅ | ✅ |
| **Mistral** | mistral-large | 128K | 60–100 | $2.00 | ✅ | ❌ | ✅ |
| **Together.ai** | llama-3.1-70b | 128K | 100–200 | $0.88 | ✅ | ❌ | ✅ |
| **Fireworks.ai** | firefunction-v2 | 32K | 150–300 | $0.90 | ✅ | ❌ | ✅ |
| **Perplexity** | llama-3.1-sonar | 127K | 50–100 | $1.00 | ❌ | ❌ | ✅ |
| **OpenRouter** | (all of above) | varies | varies | +7% markup | ✅ | ✅ | ✅ |
| **xAI/Grok** | grok-beta | 128K | 60–100 | $5.00 | ✅ | ❌ | ✅ |
| **Cohere** | command-r-plus | 128K | 50–80 | $2.50 | ✅ | ❌ | ✅ |

---

## 2. LiteLLM config.yaml — Complete Configuration

Save as `src/brain/litellm_config.yaml`:

```yaml
model_list:
  # Fast chat — voice responses, quick Q&A
  - model_name: jarvis-fast
    litellm_params:
      model: groq/llama-3.1-8b-instant
      api_key: os.environ/GROQ_API_KEY
      max_tokens: 1024
      timeout: 8

  # Balanced — most tasks
  - model_name: jarvis-fast
    litellm_params:
      model: groq/llama-3.3-70b-versatile
      api_key: os.environ/GROQ_API_KEY
      max_tokens: 2048
      timeout: 15

  # Vision-capable — screen understanding, image tasks
  - model_name: jarvis-vision
    litellm_params:
      model: gemini/gemini-1.5-flash
      api_key: os.environ/GEMINI_API_KEY
      max_tokens: 2048
      timeout: 20

  # Long context — documents, code review
  - model_name: jarvis-long
    litellm_params:
      model: gemini/gemini-1.5-pro
      api_key: os.environ/GEMINI_API_KEY
      max_tokens: 4096
      timeout: 45

  # Smart/cheap — general reasoning, coding
  - model_name: jarvis-smart
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
      max_tokens: 4096
      timeout: 30

  # Deep reasoning — complex multi-step
  - model_name: jarvis-reason
    litellm_params:
      model: deepseek/deepseek-reasoner
      api_key: os.environ/DEEPSEEK_API_KEY
      max_tokens: 8192
      timeout: 120

  # OpenRouter fallback — any model via one key
  - model_name: jarvis-fallback
    litellm_params:
      model: openrouter/google/gemini-flash-1.5
      api_key: os.environ/OPENROUTER_API_KEY
      max_tokens: 2048
      timeout: 25

router_settings:
  routing_strategy: least-busy          # or latency-based
  num_retries: 3
  retry_after: 2
  allowed_fails: 2                      # before marking model unhealthy
  cooldown_time: 60                     # seconds before retrying failed model
  timeout: 30

litellm_settings:
  success_callback: ["langfuse"]        # optional observability
  failure_callback: ["langfuse"]
  cache: true
  cache_params:
    type: local
    ttl: 300
  drop_params: true                     # ignore unsupported params per model
  set_verbose: false
  telemetry: false                      # don't send usage to LiteLLM cloud
```

---

## 3. OpenRouter as Universal Fallback

Single API key unlocks 200+ models. Good as a last-resort fallback when primary providers are down.

```python
import litellm, os

# In litellm, prefix with "openrouter/"
response = litellm.completion(
    model="openrouter/google/gemini-flash-1.5",
    messages=[{"role": "user", "content": "Hello"}],
    api_key=os.getenv("OPENROUTER_API_KEY"),
    extra_headers={
        "HTTP-Referer": "https://jarvis.local",
        "X-Title": "JARVIS",
    }
)
```

### Fallback routing array (when specific provider fails)

```python
import litellm

response = litellm.completion(
    model="groq/llama-3.1-8b-instant",
    messages=[{"role": "user", "content": "Hello"}],
    fallbacks=[
        "gemini/gemini-1.5-flash",
        "deepseek/deepseek-chat",
        "openrouter/meta-llama/llama-3.1-8b-instruct:free",
    ],
    context_window_fallbacks=[
        {"gemini/gemini-1.5-flash": ["gemini/gemini-1.5-pro"]},
    ],
)
```

---

## 4. Key Management — SecureKeyRingManager

```python
# src/brain/llm/key_manager.py
import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

@dataclass
class ProviderBudget:
    monthly_limit_usd: float
    spent_usd: float = 0.0
    rate_limited_until: datetime | None = None

class SecureKeyRingManager:
    """Manages API keys with rotation, budget tracking, and circuit breakers."""

    def __init__(self):
        self._budgets: dict[str, ProviderBudget] = {
            "groq":       ProviderBudget(monthly_limit_usd=10.0),
            "gemini":     ProviderBudget(monthly_limit_usd=20.0),
            "deepseek":   ProviderBudget(monthly_limit_usd=15.0),
            "openai":     ProviderBudget(monthly_limit_usd=30.0),
            "openrouter": ProviderBudget(monthly_limit_usd=20.0),
        }
        self._key_indices: dict[str, int] = defaultdict(int)

    def get_key(self, provider: str) -> str | None:
        budget = self._budgets.get(provider)
        if budget:
            if budget.rate_limited_until and datetime.utcnow() < budget.rate_limited_until:
                return None   # circuit open — skip this provider
            if budget.spent_usd >= budget.monthly_limit_usd:
                return None   # over budget

        # Support multiple keys per provider: GROQ_API_KEY, GROQ_API_KEY_2, etc.
        idx = self._key_indices.get(provider, 0)
        env_var = f"{provider.upper()}_API_KEY" if idx == 0 else f"{provider.upper()}_API_KEY_{idx+1}"
        return os.getenv(env_var)

    def record_spend(self, provider: str, cost_usd: float) -> None:
        if provider in self._budgets:
            self._budgets[provider].spent_usd += cost_usd

    def mark_rate_limited(self, provider: str, retry_after_s: int = 60) -> None:
        if provider in self._budgets:
            self._budgets[provider].rate_limited_until = (
                datetime.utcnow() + timedelta(seconds=retry_after_s)
            )
        # Rotate to next key
        self._key_indices[provider] = (self._key_indices.get(provider, 0) + 1) % 3

    def get_spend_summary(self) -> dict:
        return {
            p: {"spent": b.spent_usd, "limit": b.monthly_limit_usd, "pct": b.spent_usd / b.monthly_limit_usd * 100}
            for p, b in self._budgets.items()
        }

# Singleton
key_manager = SecureKeyRingManager()
```

---

## 5. Model Selection Logic

JARVIS should pick a model based on task characteristics:

```python
# src/brain/llm/router.py
from enum import Enum

class TaskType(str, Enum):
    VOICE_RESPONSE = "voice"        # needs <300ms TTFT
    QUICK_CHAT = "quick"            # short Q&A, conversational
    WEB_SEARCH_SUMMARY = "search"   # summarize search results
    VISION = "vision"               # analyze image/screenshot
    LONG_DOCUMENT = "long_doc"      # process large document
    CODE = "code"                   # write or review code
    REASONING = "reasoning"         # multi-step complex logic
    AGENT_PLANNER = "planner"       # LangGraph orchestration

MODEL_MAP = {
    TaskType.VOICE_RESPONSE:    "jarvis-fast",    # Groq — lowest TTFT
    TaskType.QUICK_CHAT:        "jarvis-fast",
    TaskType.WEB_SEARCH_SUMMARY:"jarvis-vision",  # Gemini Flash — cheap + fast
    TaskType.VISION:            "jarvis-vision",  # Gemini 1.5 Flash
    TaskType.LONG_DOCUMENT:     "jarvis-long",    # Gemini 1.5 Pro — 2M context
    TaskType.CODE:              "jarvis-smart",   # DeepSeek-V3 — best code/$ ratio
    TaskType.REASONING:         "jarvis-reason",  # DeepSeek-R1
    TaskType.AGENT_PLANNER:     "jarvis-smart",
}

def select_model(task_type: TaskType) -> str:
    return MODEL_MAP.get(task_type, "jarvis-fast")
```

---

## 6. Universal Tool Calling (works across all providers via LiteLLM)

LiteLLM normalizes tool calling to the OpenAI format for all providers.

```python
import litellm

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the internet for current information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    }
]

async def llm_with_tools(messages: list, model: str = "jarvis-fast") -> dict:
    response = await litellm.acompletion(
        model=model,
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
    )
    msg = response.choices[0].message

    if msg.tool_calls:
        return {
            "type": "tool_calls",
            "calls": [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "args": tc.function.arguments,  # JSON string
                }
                for tc in msg.tool_calls
            ]
        }

    return {"type": "text", "content": msg.content}
```

### Streaming with tool calling

```python
async def stream_with_tools(messages: list, model: str = "jarvis-fast"):
    tool_call_buffer = {}
    async for chunk in await litellm.acompletion(
        model=model,
        messages=messages,
        tools=TOOLS,
        stream=True,
    ):
        delta = chunk.choices[0].delta
        if delta.content:
            yield {"type": "text_delta", "text": delta.content}
        if delta.tool_calls:
            for tc in delta.tool_calls:
                idx = tc.index
                if idx not in tool_call_buffer:
                    tool_call_buffer[idx] = {"id": tc.id, "name": "", "args": ""}
                if tc.function:
                    tool_call_buffer[idx]["name"] += tc.function.name or ""
                    tool_call_buffer[idx]["args"] += tc.function.arguments or ""

    for tc in tool_call_buffer.values():
        yield {"type": "tool_call", **tc}
```

---

## 7. Adding a New Provider — Step by Step

1. **Get API key** and add to `.env`:
   ```
   MISTRAL_API_KEY=sk-...
   ```

2. **Add model alias** to `src/brain/litellm_config.yaml`:
   ```yaml
   - model_name: jarvis-eu          # GDPR-compliant option
     litellm_params:
       model: mistral/mistral-large-latest
       api_key: os.environ/MISTRAL_API_KEY
       max_tokens: 4096
       timeout: 30
   ```

3. **Add to MODEL_MAP** in `src/brain/llm/router.py` if relevant to a task type.

4. **Add budget** to `SecureKeyRingManager.__init__`:
   ```python
   "mistral": ProviderBudget(monthly_limit_usd=15.0),
   ```

5. **Test**:
   ```python
   import litellm
   r = litellm.completion(
       model="mistral/mistral-large-latest",
       messages=[{"role": "user", "content": "Hello"}]
   )
   print(r.choices[0].message.content)
   ```

---

## 8. Required brain-side changes

| File | Change needed |
|---|---|
| `src/brain/litellm_config.yaml` | Create — full config above |
| `src/brain/llm/__init__.py` | Create module |
| `src/brain/llm/router.py` | Create — TaskType enum + select_model() |
| `src/brain/llm/key_manager.py` | Create — SecureKeyRingManager |
| `src/brain/planner.py` | Replace hardcoded model strings with `select_model(TaskType.X)` |
| `src/brain/tools/*.py` | Replace direct litellm calls with router-aware calls |
| `.env.example` | Add all provider key names |
| `src/brain/requirements.txt` | Add: `litellm[proxy]>=1.40.0`, `langfuse>=2.0.0` (optional) |

---

## 9. .env additions required

```bash
# LLM Providers
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...           # optional
ANTHROPIC_API_KEY=sk-ant-...    # optional — not yet
OPENROUTER_API_KEY=sk-or-...    # universal fallback

# LiteLLM (if running as proxy server)
LITELLM_API_KEY=anything        # internal proxy auth
LITELLM_BASE_URL=http://localhost:4000

# Budget alerts
MONTHLY_BUDGET_USD=50.0
BUDGET_ALERT_PCT=80             # alert when 80% spent
```

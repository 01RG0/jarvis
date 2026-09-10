# LLM Providers Reference

All model IDs in this document have been live-tested against their respective APIs.
The router is configured in `src/brain/config/litellm_config.yaml`.

---

## Overview

Jarvis uses **LiteLLM Router (SDK mode)** with 16 providers and 65+ named model aliases.
Routing strategy: latency-based with multi-level fallback chains, 2 retries, 45s timeout.

Every call goes through `src/brain/llm_router.py` → `call_llm()` / `call_llm_async()`.
Never import `litellm.completion` directly — always use the router functions.

---

## Provider Table

| Provider | Alias Prefix | Confirmed Models | Env Var | Notes |
|----------|-------------|-----------------|---------|-------|
| Alibaba DashScope | `jarvis-fast`, `jarvis-balanced`, `jarvis-smart`, `jarvis-reason`, `jarvis-vision`, `jarvis-ali-*` | qwen-turbo, qwen-plus, qwen-max, qwen3-235b-a22b, qwen3.8-max-0902, qwen3.8-2.4t-a95b, qwen3-coder-next, kimi-k2.7-code, kimi-k3, deepseek-v4-pro/flash, GLM-5.3, qwq-plus, qwen3-vl-235b, qwen3-vl-flash, qwen3-omni-flash, qwen-image-3.0-pro, wan2.7-image-pro, qwen3-tts-instruct-flash, qwen-audio-3.0-asr-flash, text-embedding-v4, qwen-mt-turbo | `ALIBABA_API_KEY` + `ALIBABA_BASE_URL` | 165 total models on DashScope Maas. Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| AWS Bedrock | `jarvis-coder` | `bedrock/us.anthropic.claude-sonnet-4-6` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION_NAME` | Best model for code generation. Tested 1.5s TTFT. |
| Groq | `jarvis-groq-*` | `groq/openai/gpt-oss-20b` (0.1s!), `groq/qwen/qwen3.8-27b`, `groq/openai/gpt-oss-120b`, `groq/groq/compound-mini` | `GROQ_API_KEY` | Fastest inference available. Old Llama models decommissioned Sep 2025. |
| Google Gemini | `jarvis-cheap`, `jarvis-gemini-fast`, `jarvis-gemini-smart` | `gemini/gemini-2.5-flash` | `GEMINI_API_KEY` | Free tier, generous quota. Pro tier returns 404 on free key. |
| Cohere | `jarvis-cohere-*` | `command-r-08-2024`, `command-r-plus-08-2024`, `command-a-03-2025` | `COHERE_API_KEY` | 0.3–0.4s TTFT. Best for long-context RAG. `command-a-03-2025` has reasoning mode. |
| Mistral | `jarvis-mistral-*` | `mistral-small-latest`, `mistral-large-latest`, `codestral-latest` | `MISTRAL_API_KEY` | Codestral tested OK 0.2s. Free small tier has rate limits. |
| OpenRouter | `jarvis-or-*` | `google/gemini-flash-1.5-8b`, `anthropic/claude-opus-5`, `google/gemini-2.5-pro` | `OPENROUTER_API_KEY` | Free tier removed (all `:free` models returned no endpoints). Paid routes confirmed working. |
| TokenHarbor | `jarvis-th-free` | `deepseek-v4.1-flash:free` | `TOKEN_HARBOR_API_KEY` + `TOKEN_HARBOR_BASE_URL` | Free DeepSeek. Tested 1.3s. `https://tokenharbor.io/api/v1` |
| AiHubMix | `jarvis-aihub-*` | `gpt-4.1-free`, `gemini-3.7-flash-free` | `AIHUBMIX_API_KEY` + `AIHUBMIX_BASE_URL` | 415 models. Free tier confirmed. Tested 4.3s / 11.2s. `https://aihubmix.com/v1` |
| HuggingFace | `jarvis-hf-*` | `HuggingFaceH4/zephyr-7b-beta`, `meta-llama/Llama-3.3-70B-Instruct` | `HUGGINGFACE_API_KEY` | Serverless inference API. 70B tested OK 1.4s. `Llama-3.2-3B` returns bad request — use zephyr. |
| AnyAPI | `jarvis-anyapi-*` | `nvidia/nemotron-3-nano-30b-a3b:free`, `nvidia/nemotron-ultra-550b:free`, `qwen/qwen3-coder:free` | `ANYAPI_API_KEY` + `ANYAPI_BASE_URL` | 100+ free models. Tested OK. |
| Apertis | `jarvis-apertis-*` | `deepseek-v4.1-flash`, `claude-fable-5.1`, `qwen3.8-27b` | `APERTIS_API_KEY` + `APERTIS_BASE_URL` | All three tested OK. |
| Atessa | `jarvis-atessa-*`, `jarvis-fast-cc`, `jarvis-smart-cc` | `claude-haiku-4-5-strong`, `claude-opus-5-strong`, `gemini-3.1-flash-image` | `ATESSA_API_KEY` + `ATESSA_BASE_URL` | Replaces CodeCraft (which stopped returning responses). Alias names preserved so fallback chains unchanged. |
| Pooled | `jarvis-pooled-*` | `kimi-k2.5-fallback`, `deepseek-v4-pro-official`, `deepseek-v4-flash-official` | `POOLED_API_KEY` + `POOLED_BASE_URL` | All tested OK. |
| Pollinations | `jarvis-poll-*` | `google/gemini-2.5-flash-lite`, `meta/llama-4-maverick`, `deepseek/deepseek-v4-pro`, `deepseek/deepseek-v4-flash` | `POLLINATIONS_API_KEY` | Aggregator at `https://gen.pollinations.ai/v1`. poll-smart 2.7s, poll-reason 3s. |

---

## Task-Type Routing

`select_model(task_type, has_image=False)` in `src/brain/llm_router.py`:

| Task type | Primary alias | Underlying model |
|-----------|--------------|-----------------|
| `voice` | `jarvis-groq-instant` | gpt-oss-20b (Groq) — 0.1s |
| `fast` | `jarvis-groq-instant` | gpt-oss-20b (Groq) |
| `chat` / `balanced` | `jarvis-balanced` | qwen-plus (Alibaba) |
| `smart` | `jarvis-ali-max` | qwen3.8-max-0902 (Alibaba) |
| `long` | `jarvis-smart` | qwen-max 128K (Alibaba) |
| `code` | `jarvis-ali-coder` | qwen3-coder-next (Alibaba) |
| `kimi-code` | `jarvis-ali-kimi-code` | kimi-k2.7-code (Alibaba) |
| `reason` / `think` | `jarvis-ali-think` | qwen3.8-2.4t-a95b — 2.4T params |
| `qwq` | `jarvis-ali-qwq` | qwq-plus (Alibaba) |
| `research` | `jarvis-ali-deepseek-pro` | deepseek-v4-pro (Alibaba) |
| `search` | `jarvis-gemini-smart` | gemini-2.5-flash (good retrieval) |
| `vision` | `jarvis-ali-vl` | qwen3-vl-235b-a22b (Alibaba) |
| `vision-fast` | `jarvis-ali-vl-fast` | qwen3-vl-flash (Alibaba) |
| `omni` | `jarvis-ali-omni` | qwen3-omni-flash (audio+vision+text) |
| `image-gen` | `jarvis-ali-img-gen` | qwen-image-3.0-pro (Alibaba) |
| `image-wan` | `jarvis-ali-img-wan` | wan2.7-image-pro (Alibaba diffusion) |
| `tts` | `jarvis-ali-tts` | qwen3-tts-instruct-flash |
| `stt` | `jarvis-ali-stt` | qwen-audio-3.0-asr-flash |
| `embed` | `jarvis-ali-embed` | text-embedding-v4 |
| `translate` | `jarvis-ali-translate` | qwen-mt-turbo |
| `bulk` / `cheap` | `jarvis-cheap` | gemini-2.5-flash (free tier) |
| `free` | `jarvis-groq-instant` | gpt-oss-20b (Groq free) |
| _(has_image=True)_ | `jarvis-ali-vl` | qwen3-vl-235b-a22b |

---

## Fallback Chains

Defined in `router_settings.fallbacks` in the config YAML. When the primary alias fails, LiteLLM automatically tries the fallback list in order.

| Primary | Fallback chain |
|---------|---------------|
| `jarvis-fast` | groq-instant → gemini-fast → groq-fast → cohere-fast → th-free → poll-fast → pooled-fast |
| `jarvis-balanced` | groq-smart → gemini-fast → cohere-smart → apertis-balanced → th-free → poll-balanced |
| `jarvis-smart` | ali-max → gemini-smart → mistral-smart → groq-smart → or-smart → poll-smart → balanced → coder |
| `jarvis-coder` | ali-coder → ali-kimi-code → mistral-coder → anyapi-coder → smart → gemini-smart → smart-cc → or-smart |
| `jarvis-reason` | ali-think → ali-qwq → cohere-reason → ali-deepseek-pro → poll-reason → groq-smart → pooled-smart → smart → coder |
| `jarvis-vision` | or-vision → atessa-vision → gemini-fast → balanced |
| `jarvis-cheap` | groq-instant → cohere-fast → anyapi-fast → poll-fast → or-cheap → th-free → pooled-fast → fast |

---

## Managing Providers

The provider admin CLI is at `src/brain/tools/provider_admin.py`.
Run from repo root (not from inside `src/brain/`) to avoid import conflicts with `tools/calendar.py`.

```bash
# List all configured aliases and whether their key is set
python src/brain/tools/provider_admin.py list

# Parallel ping test — all aliases simultaneously (~40s instead of ~11min sequential)
python src/brain/tools/provider_admin.py test

# Test one alias
python src/brain/tools/provider_admin.py test jarvis-groq-instant

# Discover what models a new OpenAI-compatible endpoint offers
python src/brain/tools/provider_admin.py discover https://api.example.com/v1 MY_KEY_ENV_VAR

# Add a new alias (api_base_env is optional for native LiteLLM providers)
python src/brain/tools/provider_admin.py add my-alias openai/model-id MY_KEY_ENV [MY_BASE_ENV]

# Remove an alias (also removes it from fallback chains)
python src/brain/tools/provider_admin.py remove my-alias
```

### Adding a new OpenAI-compatible provider

1. Add key to `.env`: `MYPROVIDER_API_KEY=sk-...` and `MYPROVIDER_BASE_URL=https://...`
2. Add to `.env.example` with empty value
3. Run: `python src/brain/tools/provider_admin.py add jarvis-myprovider openai/model-id MYPROVIDER_API_KEY MYPROVIDER_BASE_URL`
4. Test: `python src/brain/tools/provider_admin.py test jarvis-myprovider`
5. Optionally add to a fallback chain in `litellm_config.yaml`

### Removed providers (and why)

| Provider | Why removed |
|----------|------------|
| OpenAI | No API key |
| Anthropic | No API key (use via Atessa/OpenRouter) |
| xAI | No API key |
| DeepSeek | No API key (use via Alibaba, Pollinations, TokenHarbor) |
| Perplexity | No API key |
| Together AI | No API key |
| Cloudflare | No API key |
| Zhipu | No API key (GLM available via Alibaba) |
| NVIDIA NIM | No API key (Nemotron available via AnyAPI free) |
| Fireworks AI | No API key |
| Cerebras | API returns "Payment required" on all models |

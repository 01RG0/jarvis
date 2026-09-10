# LLM Providers — Jarvis Reference

All providers are wired into `src/brain/config/litellm_config.yaml` and accessed through
`src/brain/llm_router.py`. Model IDs were live-tested on 2026-09-10.

---

## Provider table

| Provider | Base URL / Backend | Tested aliases | Status | Key env var(s) |
|----------|--------------------|---------------|--------|----------------|
| **Alibaba DashScope** | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `jarvis-fast`, `jarvis-balanced`, `jarvis-smart`, `jarvis-vision`, `jarvis-reason`, `jarvis-ali-flash`, `jarvis-ali-max`, `jarvis-ali-think`, `jarvis-ali-coder`, `jarvis-ali-kimi-code`, `jarvis-ali-kimi`, `jarvis-ali-deepseek-pro`, `jarvis-ali-deepseek-flash`, `jarvis-ali-glm`, `jarvis-ali-qwq`, `jarvis-ali-vl`, `jarvis-ali-vl-fast`, `jarvis-ali-omni`, `jarvis-ali-img-gen`, `jarvis-ali-img-wan`, `jarvis-ali-tts`, `jarvis-ali-stt`, `jarvis-ali-embed`, `jarvis-ali-translate` | OK | `ALIBABA_API_KEY`, `ALIBABA_BASE_URL` |
| **AWS Bedrock** | AWS SDK | `jarvis-coder` | OK 1.5s | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION_NAME` |
| **Groq** | groq SDK | `jarvis-groq-instant`, `jarvis-groq-fast`, `jarvis-groq-smart`, `jarvis-groq-compound` | OK 0.1–0.5s | `GROQ_API_KEY` |
| **Google Gemini** | gemini SDK | `jarvis-cheap`, `jarvis-gemini-fast`, `jarvis-gemini-smart` | OK | `GEMINI_API_KEY` |
| **Cohere** | cohere SDK | `jarvis-cohere-fast`, `jarvis-cohere-smart`, `jarvis-cohere-reason` | OK 0.3–0.4s | `COHERE_API_KEY` |
| **Mistral** | mistral SDK | `jarvis-mistral-fast`, `jarvis-mistral-smart`, `jarvis-mistral-coder` | OK | `MISTRAL_API_KEY` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `jarvis-or-cheap`, `jarvis-or-smart`, `jarvis-or-vision` | OK (paid) | `OPENROUTER_API_KEY` |
| **TokenHarbor** | `https://tokenharbor.io/api/v1` | `jarvis-th-free` | OK 1.3s | `TOKEN_HARBOR_API_KEY` |
| **AiHubMix** | `https://aihubmix.com/v1` | `jarvis-aihub-fast`, `jarvis-aihub-balanced` | OK 4–11s | `AIHUBMIX_API_KEY` |
| **HuggingFace** | HF Inference API | `jarvis-hf-fast`, `jarvis-hf-smart` | OK 1.4s | `HUGGINGFACE_API_KEY` |
| **AnyAPI** | `ANYAPI_BASE_URL` | `jarvis-anyapi-fast`, `jarvis-anyapi-smart`, `jarvis-anyapi-coder` | OK | `ANYAPI_API_KEY` |
| **Apertis** | `APERTIS_BASE_URL` | `jarvis-apertis-fast`, `jarvis-apertis-smart`, `jarvis-apertis-balanced` | OK | `APERTIS_API_KEY` |
| **Atessa** | `ATESSA_BASE_URL` | `jarvis-atessa-fast`, `jarvis-atessa-smart`, `jarvis-atessa-vision`, `jarvis-fast-cc`, `jarvis-smart-cc` | OK | `ATESSA_API_KEY` |
| **Pooled** | `POOLED_BASE_URL` | `jarvis-pooled-fast`, `jarvis-pooled-smart`, `jarvis-pooled-balanced` | OK | `POOLED_API_KEY` |
| **Pollinations** | `https://gen.pollinations.ai/v1` | `jarvis-poll-fast`, `jarvis-poll-balanced`, `jarvis-poll-smart`, `jarvis-poll-reason` | OK 2–3s | `POLLINATIONS_API_KEY` |

---

## All model aliases

### Alibaba DashScope (Maas workspace — 165 models)

| Alias | Model ID | Capability |
|-------|----------|-----------|
| `jarvis-fast` | `qwen-turbo` | Fast chat, 2.4s |
| `jarvis-balanced` | `qwen-plus` | Balanced quality/speed |
| `jarvis-smart` | `qwen-max` | Best Qwen generation, 128K ctx |
| `jarvis-vision` | `qwen-vl-max` | Multimodal (image + text) |
| `jarvis-reason` | `qwen3-235b-a22b` | Largest open model, 235B |
| `jarvis-ali-flash` | `qwen3.8-flash` | Ultra-fast Qwen3.8 |
| `jarvis-ali-max` | `qwen3.8-max-0902` | Best Qwen3.8 generation |
| `jarvis-ali-think` | `qwen3.8-2.4t-a95b` | 2.4T parameter reasoning model |
| `jarvis-ali-coder` | `qwen3-coder-next` | Best open coding model |
| `jarvis-ali-kimi-code` | `kimi-k2.7-code` | Kimi coding specialist |
| `jarvis-ali-kimi` | `kimi-k3` | Kimi K3 flagship |
| `jarvis-ali-deepseek-pro` | `deepseek-v4-pro` | DeepSeek V4 Pro via Alibaba |
| `jarvis-ali-deepseek-flash` | `deepseek-v4-flash` | DeepSeek V4 Flash |
| `jarvis-ali-glm` | `ZHIPU/GLM-5.3` | Zhipu GLM-5.3 via Alibaba |
| `jarvis-ali-qwq` | `qwq-plus` | QwQ reasoning model |
| `jarvis-ali-vl` | `qwen3-vl-235b-a22b-instruct` | 235B vision-language model |
| `jarvis-ali-vl-fast` | `qwen3-vl-flash` | Fast vision-language |
| `jarvis-ali-omni` | `qwen3-omni-flash` | Audio + vision + text |
| `jarvis-ali-img-gen` | `qwen-image-3.0-pro` | Image generation |
| `jarvis-ali-img-wan` | `wan2.7-image-pro` | Wan2.7 diffusion image gen |
| `jarvis-ali-tts` | `qwen3-tts-instruct-flash` | Text-to-speech |
| `jarvis-ali-stt` | `qwen-audio-3.0-asr-flash` | Speech-to-text / ASR |
| `jarvis-ali-embed` | `text-embedding-v4` | Text embeddings |
| `jarvis-ali-translate` | `qwen-mt-turbo` | Machine translation |

### AWS Bedrock

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-coder` | `bedrock/us.anthropic.claude-sonnet-4-6` | Best coding model |

### Groq (new lineup — GPT-OSS series)

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-groq-instant` | `groq/openai/gpt-oss-20b` | 0.1s TTFT, voice-optimized |
| `jarvis-groq-fast` | `groq/qwen/qwen3.8-27b` | Fast + quality |
| `jarvis-groq-smart` | `groq/openai/gpt-oss-120b` | Largest Groq model |
| `jarvis-groq-compound` | `groq/groq/compound-mini` | Multi-step reasoning |

### Google Gemini

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-cheap` | `gemini/gemini-2.5-flash` | Free tier |
| `jarvis-gemini-fast` | `gemini/gemini-2.5-flash` | Same; named for fallbacks |
| `jarvis-gemini-smart` | `gemini/gemini-2.5-flash` | Flash is free; Pro not on free key |

### Cohere

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-cohere-fast` | `cohere/command-r-08-2024` | 0.3s, long-context RAG |
| `jarvis-cohere-smart` | `cohere/command-r-plus-08-2024` | Best Command R+ |
| `jarvis-cohere-reason` | `cohere/command-a-03-2025` | Command-A reasoning |

### Mistral

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-mistral-fast` | `mistral/mistral-small-latest` | |
| `jarvis-mistral-smart` | `mistral/mistral-large-latest` | |
| `jarvis-mistral-coder` | `mistral/codestral-latest` | Best code completion |

### OpenRouter

| Alias | Model ID | Notes |
|-------|----------|-------|
| `jarvis-or-cheap` | `openrouter/google/gemini-flash-1.5-8b` | Cheap fallback |
| `jarvis-or-smart` | `openrouter/anthropic/claude-opus-5` | Best via OpenRouter |
| `jarvis-or-vision` | `openrouter/google/gemini-2.5-pro` | Vision via OpenRouter |

### Other providers

| Alias | Model | Provider |
|-------|-------|----------|
| `jarvis-th-free` | `deepseek-v4.1-flash:free` | TokenHarbor |
| `jarvis-aihub-fast` | `gpt-4.1-free` | AiHubMix |
| `jarvis-aihub-balanced` | `gemini-3.7-flash-free` | AiHubMix |
| `jarvis-hf-fast` | `HuggingFaceH4/zephyr-7b-beta` | HuggingFace |
| `jarvis-hf-smart` | `meta-llama/Llama-3.3-70B-Instruct` | HuggingFace |
| `jarvis-anyapi-fast` | `nvidia/nemotron-3-nano-30b-a3b:free` | AnyAPI |
| `jarvis-anyapi-smart` | `nvidia/nemotron-ultra-550b:free` | AnyAPI |
| `jarvis-anyapi-coder` | `qwen/qwen3-coder:free` | AnyAPI |
| `jarvis-apertis-fast` | `deepseek-v4.1-flash` | Apertis |
| `jarvis-apertis-smart` | `claude-fable-5.1` | Apertis |
| `jarvis-apertis-balanced` | `qwen3.8-27b` | Apertis |
| `jarvis-atessa-fast` / `jarvis-fast-cc` | `claude-haiku-4-5-strong` | Atessa |
| `jarvis-atessa-smart` / `jarvis-smart-cc` | `claude-opus-5-strong` | Atessa |
| `jarvis-atessa-vision` | `gemini-3.1-flash-image` | Atessa |
| `jarvis-pooled-fast` | `kimi-k2.5-fallback` | Pooled |
| `jarvis-pooled-smart` | `deepseek-v4-pro-official` | Pooled |
| `jarvis-pooled-balanced` | `deepseek-v4-flash-official` | Pooled |
| `jarvis-poll-fast` | `google/gemini-2.5-flash-lite` | Pollinations |
| `jarvis-poll-balanced` | `meta/llama-4-maverick` | Pollinations |
| `jarvis-poll-smart` | `deepseek/deepseek-v4-pro` | Pollinations |
| `jarvis-poll-reason` | `deepseek/deepseek-v4-flash` | Pollinations |

---

## Task routing

`select_model(task_type)` in `src/brain/llm_router.py` maps task types to the best alias.

| Task type | Alias | Model |
|-----------|-------|-------|
| `voice`, `fast`, `free` | `jarvis-groq-instant` | GPT-OSS-20B (0.1s) |
| `chat`, `balanced` | `jarvis-balanced` | Qwen Plus |
| `smart` | `jarvis-ali-max` | Qwen3.8-Max |
| `long` | `jarvis-smart` | Qwen Max (128K) |
| `code` | `jarvis-ali-coder` | qwen3-coder-next |
| `kimi-code` | `jarvis-ali-kimi-code` | kimi-k2.7-code |
| `reason`, `think` | `jarvis-ali-think` | qwen3.8-2.4T |
| `qwq` | `jarvis-ali-qwq` | QwQ-Plus |
| `research` | `jarvis-ali-deepseek-pro` | DeepSeek V4 Pro |
| `search` | `jarvis-gemini-smart` | Gemini 2.5 Flash |
| `vision` | `jarvis-ali-vl` | Qwen3-VL-235B |
| `vision-fast` | `jarvis-ali-vl-fast` | Qwen3-VL-Flash |
| `omni` | `jarvis-ali-omni` | Qwen3-Omni-Flash |
| `image-gen` | `jarvis-ali-img-gen` | Qwen-Image-3.0-Pro |
| `image-wan` | `jarvis-ali-img-wan` | Wan2.7-image-pro |
| `tts` | `jarvis-ali-tts` | Qwen3-TTS-Instruct-Flash |
| `stt` | `jarvis-ali-stt` | Qwen-Audio-3.0-ASR-Flash |
| `embed` | `jarvis-ali-embed` | text-embedding-v4 |
| `translate` | `jarvis-ali-translate` | Qwen-MT-Turbo |
| `bulk`, `cheap` | `jarvis-cheap` | Gemini 2.5 Flash (free) |

Pass `has_image=True` to force `jarvis-ali-vl` regardless of task_type.

---

## Fallback chains

Router falls back in order if a model fails or times out (`allowed_fails: 2`, `cooldown_time: 60s`).

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

## Provider admin CLI

`src/brain/tools/provider_admin.py` — manage providers from the command line.

```bash
# List all aliases with key-set status
python src/brain/tools/provider_admin.py list

# Parallel ping all models (async, 15s timeout each)
python src/brain/tools/provider_admin.py test

# Ping a single alias
python src/brain/tools/provider_admin.py test jarvis-fast

# Discover available models from an OpenAI-compatible endpoint
python src/brain/tools/provider_admin.py discover https://api.example.com/v1 MY_KEY_ENV

# Add a new alias
python src/brain/tools/provider_admin.py add my-alias openai/model-id MY_KEY_ENV [MY_BASE_ENV]

# Remove an alias (also removes it from all fallback chains)
python src/brain/tools/provider_admin.py remove my-alias
```

The same test endpoint is exposed over HTTP: `POST /api/providers/test/{alias}`.

---

## Known issues / decisions

- **Cerebras removed** — all model IDs failed + payment required (no free tier).
- **CodeCraft removed** — API returns empty body on all completions; aliases `jarvis-fast-cc` / `jarvis-smart-cc` now point to Atessa as drop-in replacement.
- **OpenRouter free tier gone** — all `:free` models either "no endpoints" or "unavailable"; replaced with paid `gemini-flash-1.5-8b` as `jarvis-or-cheap`.
- **Gemini Pro not on free key** — `gemini-2.5-pro` returns 404; all Gemini aliases use `gemini-2.5-flash`.
- **Groq full model refresh** — old Llama lineup decommissioned; replaced with GPT-OSS-20B/120B, Qwen3.8-27B, Compound-Mini.
- **Cohere IDs** — `command-r-plus-08-2024` and `command-a-03-2025` (not future-dated variants).
- **Windows encoding** — provider_admin.py uses `[OK]`/`[!!]` instead of Unicode symbols to avoid cp1252 issues.
- **`calendar.py` stdlib clash** — run provider_admin.py from repo root or with adjusted `sys.path` to avoid `tools/calendar.py` shadowing stdlib.

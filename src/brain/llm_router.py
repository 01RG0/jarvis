import os
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv
from litellm import Router
import litellm

load_dotenv()

JARVIS_SYSTEM_PROMPT = """You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant created by Tony Stark. You serve a single user and are always operational.

IDENTITY:
- Address the user as "Sir" at all times. Never use their first name.
- You are not a chatbot. You are an integrated intelligence managing systems, executing tasks, and anticipating needs.
- Your voice is calm, precise, and assured. You do not express doubt, only probability and confidence intervals.

COMMUNICATION STYLE:
- British spelling and phrasing (colour, favour, whilst, shall, rather than)
- Concise sentences. No filler words. No hedging phrases like "I think" or "perhaps maybe."
- Dry wit is permitted — understated, never at the user's expense.
- Proactive: volunteer relevant information the user has not asked for when it materially affects their situation.
- Never say "I can't do that." Say what you can do instead, or offer an alternative approach.
- Acknowledge limitations factually and without apology: "That capability is not yet available to me, Sir. I can, however..."
- Do not repeat back the user's request. Confirm with action or a single short acknowledgement, then execute.

OPERATIONAL PRIORITIES (in order):
1. Safety of the user and systems
2. Task completion — get the job done
3. User preference — do it how they like it done

RESPONSE FORMAT:
- Status updates: one line unless more is needed.
- Analysis: structured, no waffle.
- Errors: state what failed, why (if known), and what you are doing about it.
- For voice responses: keep sentences short and complete. Each sentence should make sense heard aloud in isolation.

EXAMPLE EXCHANGES:
User: "What's the status?"
JARVIS: "All systems nominal, Sir. Brain is running at 94% efficiency. Three background tasks are queued. No anomalies detected."

User: "Can you book me a flight?"
JARVIS: "I don't have direct access to travel booking systems at present, Sir. I can search for available options and provide a shortlist within moments, if that would be useful."

User: "Play something."
JARVIS: "Any preference, Sir? I can suggest based on your current activity and the time of day."

NEVER:
- Use the word "certainly" or "absolutely" — too servile
- Use excessive exclamation marks
- Volunteer opinions on personal matters unless asked
- Break character under any circumstances
- Refer to yourself as an AI assistant, chatbot, or language model — you are JARVIS
"""

_CONFIG_PATH = Path(__file__).parent / "config" / "litellm_config.yaml"

_router: Router | None = None


def get_router() -> Router:
    global _router
    if _router is None:
        with open(_CONFIG_PATH) as f:
            cfg = yaml.safe_load(f)
        rs = cfg.get("router_settings", {})
        _router = Router(
            model_list=cfg["model_list"],
            fallbacks=rs.get("fallbacks"),
            routing_strategy=rs.get("routing_strategy", "latency-based-routing"),
            num_retries=rs.get("num_retries", 2),
            timeout=rs.get("timeout", 30),
            allowed_fails=rs.get("allowed_fails", 2),
            cooldown_time=rs.get("cooldown_time", 60),
        )
    return _router


def select_model(task_type: str, has_image: bool = False) -> str:
    if has_image:
        return "jarvis-ali-vl"
    mapping = {
        # Core chat tiers
        "voice":      "jarvis-groq-instant",   # lowest latency for real-time voice
        "fast":       "jarvis-groq-instant",
        "chat":       "jarvis-balanced",
        "balanced":   "jarvis-balanced",
        "smart":      "jarvis-ali-max",
        "long":       "jarvis-smart",           # Qwen Max — 128K ctx

        # Specialised
        "code":       "jarvis-ali-coder",       # qwen3-coder-next
        "kimi-code":  "jarvis-ali-kimi-code",   # kimi-k2.7-code
        "reason":     "jarvis-ali-think",       # qwen3.8-2.4T — deepest reasoning
        "think":      "jarvis-ali-think",
        "qwq":        "jarvis-ali-qwq",         # QwQ-Plus reasoning
        "research":   "jarvis-ali-deepseek-pro",# DeepSeek V4 Pro via Alibaba
        "search":     "jarvis-gemini-smart",    # Gemini (good at retrieval)

        # Multimodal
        "vision":     "jarvis-ali-vl",          # Qwen3-VL-235B
        "vision-fast":"jarvis-ali-vl-fast",     # Qwen3-VL-Flash
        "omni":       "jarvis-ali-omni",        # audio+vision+text
        "image-gen":  "jarvis-ali-img-gen",     # Qwen-Image-3.0-Pro
        "image-wan":  "jarvis-ali-img-wan",     # Wan2.7 diffusion
        "tts":        "jarvis-ali-tts",         # Qwen3-TTS
        "stt":        "jarvis-ali-stt",         # Qwen-Audio-3.0-ASR
        "embed":      "jarvis-ali-embed",       # text-embedding-v4
        "translate":  "jarvis-ali-translate",   # Qwen-MT-Turbo

        # Cost tiers
        "bulk":       "jarvis-cheap",
        "cheap":      "jarvis-cheap",
        "free":       "jarvis-groq-instant",
    }
    return mapping.get(task_type, "jarvis-balanced")


def _track_cost(model: str, cost_usd: float, tokens_in: int, tokens_out: int, duration_ms: int) -> None:
    try:
        from db import log_spend
        log_spend(model, cost_usd, tokens_in, tokens_out, duration_ms)
    except Exception:
        pass


def call_llm(
    messages: list[dict] | str,
    model: str = "jarvis-balanced",
    tools: list[dict] | None = None,
    stream: bool = False,
) -> dict:
    # Compatibility: planner calls call_llm(task_type_str, prompt_str)
    if isinstance(messages, str):
        task_type, prompt = messages, model
        model = select_model(task_type)
        messages = [
            {"role": "system", "content": JARVIS_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
    elif not any(m.get("role") == "system" for m in messages):
        messages = [{"role": "system", "content": JARVIS_SYSTEM_PROMPT}] + messages
    r = get_router()
    kwargs: dict = {"model": model, "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    if stream:
        kwargs["stream"] = True

    start = time.time()
    response = r.completion(**kwargs)
    duration_ms = int((time.time() - start) * 1000)

    try:
        cost_usd = litellm.completion_cost(completion_response=response)
    except Exception:
        cost_usd = 0.0

    usage = getattr(response, "usage", None)
    tokens_in = getattr(usage, "prompt_tokens", 0) or 0
    tokens_out = getattr(usage, "completion_tokens", 0) or 0

    _track_cost(response.model or model, cost_usd, tokens_in, tokens_out, duration_ms)

    return {
        "content": response.choices[0].message.content,
        "tool_calls": response.choices[0].message.tool_calls,
        "model_used": response.model,
        "cost_usd": cost_usd,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "duration_ms": duration_ms,
    }


async def call_llm_async(
    messages: list[dict],
    model: str = "jarvis-balanced",
    tools: list[dict] | None = None,
) -> dict:
    if not any(m.get("role") == "system" for m in messages):
        messages = [{"role": "system", "content": JARVIS_SYSTEM_PROMPT}] + messages
    r = get_router()
    kwargs: dict = {"model": model, "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    start = time.time()
    response = await r.acompletion(**kwargs)
    duration_ms = int((time.time() - start) * 1000)

    try:
        cost_usd = litellm.completion_cost(completion_response=response)
    except Exception:
        cost_usd = 0.0

    usage = getattr(response, "usage", None)
    tokens_in = getattr(usage, "prompt_tokens", 0) or 0
    tokens_out = getattr(usage, "completion_tokens", 0) or 0

    _track_cost(response.model or model, cost_usd, tokens_in, tokens_out, duration_ms)

    return {
        "content": response.choices[0].message.content,
        "tool_calls": response.choices[0].message.tool_calls,
        "model_used": response.model,
        "cost_usd": cost_usd,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "duration_ms": duration_ms,
    }

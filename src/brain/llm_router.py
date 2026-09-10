import os
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv
from litellm import Router
import litellm

load_dotenv()

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
    messages: list[dict],
    model: str = "jarvis-balanced",
    tools: list[dict] | None = None,
    stream: bool = False,
) -> dict:
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

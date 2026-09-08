import os
import time

from dotenv import load_dotenv
from litellm import Router
import litellm

load_dotenv()

router = Router(
    model_list=[
        {
            "model_name": "fast",
            "litellm_params": {
                "model": "groq/llama-3.1-8b-instant",
                "api_key": os.environ.get("GROQ_API_KEY", ""),
            },
        },
        {
            "model_name": "balanced",
            "litellm_params": {
                "model": "gemini/gemini-1.5-flash",
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
            },
        },
        {
            "model_name": "smart",
            "litellm_params": {
                "model": "gemini/gemini-1.5-pro",
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
            },
        },
    ],
    fallbacks=[
        {"smart": ["balanced", "fast"]},
        {"balanced": ["fast"]},
    ],
    allowed_fails=2,
    cooldown_time=60,
)


def call_llm(model: str, prompt: str, system: str = "") -> dict:
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        start = time.time()
        response = router.completion(model=model, messages=messages)
        duration_ms = int((time.time() - start) * 1000)

        try:
            cost_usd = litellm.completion_cost(completion_response=response)
        except Exception:
            cost_usd = 0.0

        return {
            "content": response.choices[0].message.content,
            "model_used": response.model,
            "cost_usd": cost_usd,
            "duration_ms": duration_ms,
        }
    except Exception as e:
        raise RuntimeError(f"LLM call failed: {e}") from e

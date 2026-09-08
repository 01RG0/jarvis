import asyncio
from dataclasses import dataclass
from typing import Optional, Callable, Any

MODEL_FALLBACK = ["fast", "balanced", "smart"]


@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    backoff_factor: float = 2.0


def next_model(current: str) -> Optional[str]:
    try:
        idx = MODEL_FALLBACK.index(current)
        if idx + 1 < len(MODEL_FALLBACK):
            return MODEL_FALLBACK[idx + 1]
    except ValueError:
        pass
    return None


async def with_retry(
    fn: Callable,
    config: RetryConfig = RetryConfig(),
    task_id: str = "",
) -> Any:
    last_exc: Optional[Exception] = None
    for attempt in range(config.max_attempts):
        try:
            return await fn()
        except Exception as e:
            last_exc = e
            if attempt < config.max_attempts - 1:
                delay = min(
                    config.base_delay * (config.backoff_factor ** attempt),
                    config.max_delay,
                )
                await asyncio.sleep(delay)
    raise last_exc  # type: ignore[misc]

"""Prometheus metrics — all operations are no-ops if prometheus_client is unavailable."""
from __future__ import annotations

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    REGISTRY_AVAILABLE = True
except ImportError:
    REGISTRY_AVAILABLE = False

if REGISTRY_AVAILABLE:
    llm_requests_total = Counter(
        'jarvis_llm_requests_total', 'LLM requests', ['model', 'path']
    )
    llm_latency_seconds = Histogram(
        'jarvis_llm_latency_seconds', 'LLM call duration', ['model'],
        buckets=[0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    )
    llm_cost_usd_total = Counter(
        'jarvis_llm_cost_usd_total', 'LLM cost in USD', ['model']
    )
    task_duration_seconds = Histogram(
        'jarvis_task_duration_seconds', 'Full task duration', ['path'],
        buckets=[0.1, 0.5, 1, 2, 5, 15, 30, 60],
    )
    memory_hits_total = Counter(
        'jarvis_memory_hits_total', 'Memory context hits'
    )
    memory_errors_total = Counter(
        'jarvis_memory_errors_total', 'Memory init/fetch errors'
    )
    active_tasks = Gauge(
        'jarvis_active_tasks', 'Tasks currently processing'
    )
    brain_info = Gauge(
        'jarvis_build_info', 'Build info', ['version']
    )


def record_llm_call(model: str, path: str, latency_s: float, cost_usd: float) -> None:
    try:
        if not REGISTRY_AVAILABLE:
            return
        llm_requests_total.labels(model=model, path=path).inc()
        llm_latency_seconds.labels(model=model).observe(latency_s)
        if cost_usd > 0:
            llm_cost_usd_total.labels(model=model).inc(cost_usd)
    except Exception:
        pass


def record_task(path: str, duration_s: float) -> None:
    try:
        if not REGISTRY_AVAILABLE:
            return
        task_duration_seconds.labels(path=path).observe(duration_s)
    except Exception:
        pass


def inc_memory_hit() -> None:
    try:
        if REGISTRY_AVAILABLE:
            memory_hits_total.inc()
    except Exception:
        pass


def inc_memory_error() -> None:
    try:
        if REGISTRY_AVAILABLE:
            memory_errors_total.inc()
    except Exception:
        pass


def set_active_tasks(n: int) -> None:
    try:
        if REGISTRY_AVAILABLE:
            active_tasks.set(n)
    except Exception:
        pass

"""Learning loop — persists failure/retry outcomes into Mem0 so the brain
improves across sessions without manual intervention."""
import logging
import threading
import time
from typing import Literal

logger = logging.getLogger(__name__)

OutcomeType = Literal['success', 'retry', 'failure', 'fallback']


def record_outcome(
    task_input: str,
    result: str,
    outcome: OutcomeType,
    error: str = '',
    attempts: int = 1,
    model_used: str = '',
) -> None:
    """Fire-and-forget: persist outcome to Mem0 so future plans can avoid the same mistake."""
    threading.Thread(
        target=_persist,
        args=(task_input, result, outcome, error, attempts, model_used),
        daemon=True,
    ).start()


def _persist(
    task_input: str,
    result: str,
    outcome: OutcomeType,
    error: str,
    attempts: int,
    model_used: str,
) -> None:
    try:
        from memory import get_memory
        mem = get_memory()

        if outcome == 'success' and attempts == 1:
            # Straightforward success — nothing to learn, memory.py already stores the conversation
            return

        if outcome in ('retry', 'failure', 'fallback'):
            content = (
                f'[LESSON] Task failed or needed retries.\n'
                f'Input: {task_input[:400]}\n'
                f'Outcome: {outcome}, attempts: {attempts}, model: {model_used}\n'
                f'Error: {error[:300]}\n'
                f'Result: {result[:300]}'
            )
        else:
            # Slow-path success after retries — note what eventually worked
            content = (
                f'[LESSON] Task succeeded after {attempts} attempts.\n'
                f'Input: {task_input[:400]}\n'
                f'Model that worked: {model_used}\n'
                f'Result summary: {result[:300]}'
            )

        mem.add(content)
        logger.debug('Learning loop persisted outcome=%s for task: %s…', outcome, task_input[:60])
    except Exception as exc:
        logger.warning('Learning loop persist failed: %s', exc)

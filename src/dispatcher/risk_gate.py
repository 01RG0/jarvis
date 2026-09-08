TIER_NAMES = {0: 'Autonomous', 1: 'Notify-after', 2: 'Confirm-first', 3: 'Always manual'}

_approved_tasks: set[str] = set()

def enforce_tier(tier: int, task_id: str) -> None:
    if tier == 0:
        return
    if tier == 1:
        return  # proceed, caller should log after
    if tier >= 2:
        if task_id in _approved_tasks:
            _approved_tasks.discard(task_id)
            return
        raise PermissionError(f'Tier {tier} ({TIER_NAMES.get(tier, "Manual")}) action requires explicit approval before dispatch. Task: {task_id}')

def approve_task(task_id: str) -> None:
    _approved_tasks.add(task_id)

def classify_prompt(prompt: str) -> int:
    prompt_lower = prompt.lower()
    tier3 = {'spend', 'purchase', 'buy', 'payment', 'credit', 'top up', 'top-up'}
    tier2 = {'deploy', 'push to production', 'delete', 'drop table', 'rm -rf', 'force push', 'prod'}
    tier1 = {'write to memory', 'update config', 'save', 'complete task'}
    if any(w in prompt_lower for w in tier3): return 3
    if any(w in prompt_lower for w in tier2): return 2
    if any(w in prompt_lower for w in tier1): return 1
    return 0

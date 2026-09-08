from dataclasses import dataclass, field

@dataclass
class DispatchRequest:
    task_id: str
    prompt: str
    tier: int = 0                    # risk tier 0-3
    preferred_cli: str = 'agy'       # preferred CLI to use
    timeout_seconds: int = 300       # max time to wait
    workdir: str = ''                # override workdir (optional)

@dataclass
class DispatchResult:
    task_id: str
    cli: str
    stdout: str
    exit_code: int
    duration_seconds: float
    success: bool
    error: str = ''

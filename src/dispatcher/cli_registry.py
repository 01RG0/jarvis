import shutil, os

KNOWN_CLIS = ['codex', 'agy', 'kilo', 'grok', 'vibe', 'freebuff']

def detect_available_clis() -> dict[str, bool]:
    return {cli: shutil.which(cli) is not None for cli in KNOWN_CLIS}

def build_command(cli: str, prompt: str, workdir: str) -> list[str]:
    if cli == 'codex':
        return ['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', workdir, prompt]
    elif cli == 'agy':
        return ['agy', '--dangerously-skip-permissions', f'--print={prompt}']
    elif cli == 'kilo':
        return ['kilo', 'run', prompt, '--dir', workdir]
    elif cli in ('grok', 'agent'):
        return [cli, '-p', prompt, '--always-approve', '--cwd', workdir]
    elif cli == 'vibe':
        return ['vibe', '-p', prompt, '--auto-approve', '--workdir', workdir]
    elif cli == 'freebuff':
        return ['freebuff', prompt, '--cwd', workdir]
    raise ValueError(f'Unknown CLI: {cli}')

"""
provider_admin.py — manage and test LiteLLM providers in litellm_config.yaml

Usage:
  python provider_admin.py list               # show all configured providers
  python provider_admin.py test               # ping every model (parallel)
  python provider_admin.py test <alias>       # ping one model alias
  python provider_admin.py discover <base_url> <api_key_env>  # list /v1/models
  python provider_admin.py add <alias> <model> <api_key_env> [api_base_env]
  python provider_admin.py remove <alias>
"""

import asyncio
import os
import sys
import time
from pathlib import Path

import httpx
import yaml
from dotenv import load_dotenv
from litellm import Router
import litellm

load_dotenv()

CONFIG_PATH = Path(__file__).parent.parent / "config" / "litellm_config.yaml"
PING_MSG = [{"role": "user", "content": "Reply with exactly: OK"}]
TIMEOUT = 15


def _load_cfg() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def _save_cfg(cfg: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def _resolve_env(val: str) -> str:
    if val and val.startswith("os.environ/"):
        return os.getenv(val[len("os.environ/"):], "")
    return val or ""


def cmd_list() -> None:
    cfg = _load_cfg()
    print(f"{'ALIAS':<28} {'MODEL':<50} {'KEY SET'}")
    print("-" * 90)
    for m in cfg["model_list"]:
        alias = m["model_name"]
        model = m["litellm_params"]["model"]
        key_env = m["litellm_params"].get("api_key", "")
        key_val = _resolve_env(key_env)
        has_key = "[OK]" if key_val and len(key_val) > 4 else "[--]"
        print(f"{alias:<28} {model:<50} {has_key}")


async def _ping_one(router: Router, alias: str, model_str: str) -> tuple[str, str, float]:
    start = time.time()
    try:
        resp = await asyncio.wait_for(
            router.acompletion(model=alias, messages=PING_MSG, max_tokens=8),
            timeout=TIMEOUT,
        )
        content = resp.choices[0].message.content or ""
        elapsed = time.time() - start
        return alias, f"[OK] {elapsed:.1f}s  {content.strip()[:40]}", elapsed
    except Exception as e:
        elapsed = time.time() - start
        return alias, f"[!!] {str(e)[:70]}", elapsed


async def _run_tests(aliases: list[str]) -> None:
    cfg = _load_cfg()
    rs = cfg.get("router_settings", {})
    router = Router(
        model_list=cfg["model_list"],
        num_retries=0,
        timeout=TIMEOUT,
        fallbacks=[],
    )
    tasks = [_ping_one(router, alias, "") for alias in aliases]
    results = await asyncio.gather(*tasks)
    results.sort(key=lambda r: r[2])
    print(f"\n{'ALIAS':<28} RESULT")
    print("-" * 90)
    for alias, result, _ in results:
        print(f"{alias:<28} {result}")
    ok = sum(1 for _, r, _ in results if r.startswith("[OK]"))
    print(f"\n{ok}/{len(results)} providers responding")


def cmd_test(target: str | None = None) -> None:
    cfg = _load_cfg()
    if target:
        aliases = [target]
    else:
        aliases = [m["model_name"] for m in cfg["model_list"]]
    asyncio.run(_run_tests(aliases))


async def _discover(base_url: str, api_key: str) -> None:
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{base_url}/models", headers=headers)
        r.raise_for_status()
        data = r.json()
    models = data.get("data", data) if isinstance(data, dict) else data
    print(f"{'ID'}")
    print("-" * 60)
    for m in models:
        mid = m.get("id", m) if isinstance(m, dict) else m
        print(mid)


def cmd_discover(base_url: str, api_key_env: str) -> None:
    api_key = os.getenv(api_key_env, "")
    if not api_key:
        print(f"ERROR: {api_key_env} not set in .env")
        sys.exit(1)
    asyncio.run(_discover(base_url, api_key))


def cmd_add(alias: str, model: str, api_key_env: str, api_base_env: str | None = None) -> None:
    cfg = _load_cfg()
    existing = [m["model_name"] for m in cfg["model_list"]]
    if alias in existing:
        print(f"ERROR: alias '{alias}' already exists. Use remove first.")
        sys.exit(1)
    entry: dict = {
        "model_name": alias,
        "litellm_params": {
            "model": model,
            "api_key": f"os.environ/{api_key_env}",
        },
    }
    if api_base_env:
        entry["litellm_params"]["api_base"] = f"os.environ/{api_base_env}"
    cfg["model_list"].append(entry)
    _save_cfg(cfg)
    print(f"Added {alias} → {model}")


def cmd_remove(alias: str) -> None:
    cfg = _load_cfg()
    before = len(cfg["model_list"])
    cfg["model_list"] = [m for m in cfg["model_list"] if m["model_name"] != alias]
    for chain in cfg.get("router_settings", {}).get("fallbacks", []):
        for k in list(chain.keys()):
            if k == alias:
                del chain[k]
            elif isinstance(chain[k], list):
                chain[k] = [v for v in chain[k] if v != alias]
    after = len(cfg["model_list"])
    if before == after:
        print(f"ERROR: alias '{alias}' not found")
        sys.exit(1)
    _save_cfg(cfg)
    print(f"Removed {alias}")


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] == "list":
        cmd_list()
    elif args[0] == "test":
        cmd_test(args[1] if len(args) > 1 else None)
    elif args[0] == "discover":
        if len(args) < 3:
            print("Usage: discover <base_url> <API_KEY_ENV_VAR>")
            sys.exit(1)
        cmd_discover(args[1], args[2])
    elif args[0] == "add":
        if len(args) < 4:
            print("Usage: add <alias> <model> <API_KEY_ENV> [API_BASE_ENV]")
            sys.exit(1)
        cmd_add(args[1], args[2], args[3], args[4] if len(args) > 4 else None)
    elif args[0] == "remove":
        if len(args) < 2:
            print("Usage: remove <alias>")
            sys.exit(1)
        cmd_remove(args[1])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()

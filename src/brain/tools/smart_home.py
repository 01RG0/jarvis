"""Home Assistant REST API tool."""
from __future__ import annotations

import os

from ._base import JarvisTool, ToolResult


class SmartHomeTool(JarvisTool):
    name = "smart_home"
    description = "Control smart home devices via Home Assistant REST API"
    tags = ["home", "light", "smart", "device", "climate", "thermostat",
            "lock", "switch", "automation", "turn on", "turn off", "dim", "temperature"]

    def run(
        self,
        action: str = "list",
        entity_id: str = "",
        temperature: float = 0.0,
        **kwargs,
    ) -> ToolResult:
        ha_url   = os.environ.get("HA_URL", "")
        ha_token = os.environ.get("HA_TOKEN", "")
        if not ha_url or not ha_token:
            return ToolResult(False, "", "HA_URL and HA_TOKEN not set in .env", self.name)

        try:
            import httpx
        except ImportError:
            return ToolResult(False, "", "httpx not installed", self.name)

        headers = {
            "Authorization": f"Bearer {ha_token}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=10) as client:
                if action == "list":
                    r = client.get(f"{ha_url}/api/states", headers=headers)
                    r.raise_for_status()
                    states = r.json()
                    keep = [s for s in states
                            if s["entity_id"].split(".")[0]
                            in ("light", "switch", "climate", "lock", "media_player")]
                    lines = [
                        f"{s['entity_id']}: {s['state']} "
                        f"({s['attributes'].get('friendly_name','')})"
                        for s in keep[:20]
                    ]
                    return ToolResult(True, "\n".join(lines) or "No devices found", tool_name=self.name)

                if action in ("turn_on", "turn_off", "toggle"):
                    r = client.post(
                        f"{ha_url}/api/services/homeassistant/{action}",
                        headers=headers, json={"entity_id": entity_id},
                    )
                    r.raise_for_status()
                    return ToolResult(True, f"{action} → {entity_id}", tool_name=self.name)

                if action == "set_temperature":
                    r = client.post(
                        f"{ha_url}/api/services/climate/set_temperature",
                        headers=headers,
                        json={"entity_id": entity_id, "temperature": temperature},
                    )
                    r.raise_for_status()
                    return ToolResult(True, f"Temperature set to {temperature} for {entity_id}", tool_name=self.name)

                if action == "get_state":
                    r = client.get(f"{ha_url}/api/states/{entity_id}", headers=headers)
                    r.raise_for_status()
                    s = r.json()
                    attrs = ", ".join(f"{k}={v}" for k, v in list(s.get("attributes", {}).items())[:8])
                    return ToolResult(True, f"{entity_id}: {s['state']} | {attrs}", tool_name=self.name)

                return ToolResult(False, "", f"Unknown action: {action}", self.name)

        except httpx.HTTPError as e:
            return ToolResult(False, "", f"HA HTTP error: {e}", self.name)
        except Exception as e:
            return ToolResult(False, "", str(e), self.name)

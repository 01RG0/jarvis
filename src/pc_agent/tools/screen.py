"""Screen capture and vision-LLM understanding."""
from __future__ import annotations

import base64
import io
import os

from . import register


def capture_screen(monitor: int = 1) -> str:
    """Return base64 JPEG of the specified monitor (1 = primary)."""
    import mss
    import mss.tools
    from PIL import Image

    with mss.mss() as sct:
        mon = sct.monitors[min(monitor, len(sct.monitors) - 1)]
        shot = sct.grab(mon)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
        # Downscale to 960px wide to keep base64 payload small
        w, h = img.size
        if w > 960:
            img = img.resize((960, int(h * 960 / w)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        return base64.b64encode(buf.getvalue()).decode()


def list_monitors() -> list[dict]:
    import mss
    with mss.mss() as sct:
        return [
            {"id": i, "left": m["left"], "top": m["top"],
             "width": m["width"], "height": m["height"]}
            for i, m in enumerate(sct.monitors)
        ]


def understand_screen(question: str) -> str:
    """Capture screen → Gemini Flash Vision → natural language answer."""
    import json
    import urllib.request

    b64 = capture_screen()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return "GEMINI_API_KEY not set — cannot analyse screen"

    body = json.dumps({
        "contents": [{
            "parts": [
                {"text": f"You are JARVIS. {question}"},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
            ]
        }]
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read())
    return data["candidates"][0]["content"]["parts"][0]["text"]


def find_and_click(target: str) -> bool:
    """Vision → find target on screen → click its centre."""
    import json
    import urllib.request
    import pyautogui

    b64 = capture_screen()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return False

    prompt = (
        f"Find '{target}' on the screenshot. "
        "Reply ONLY with JSON: {\"x\": <0-1 fraction>, \"y\": <0-1 fraction>} "
        "relative to image dimensions. If not found reply {\"x\": null, \"y\": null}."
    )
    body = json.dumps({
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]}]
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read())
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    coords = json.loads(text)
    if coords.get("x") is None:
        return False

    sw, sh = pyautogui.size()
    pyautogui.click(int(coords["x"] * sw), int(coords["y"] * sh))
    return True


register("screenshot",      capture_screen, tier="safe")
register("list_monitors",   list_monitors,  tier="safe")
register("understand_screen", understand_screen, tier="safe")
register("find_and_click",  find_and_click, tier="dangerous")

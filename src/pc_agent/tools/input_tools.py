"""Keyboard / mouse input — all DANGEROUS tier (require approval)."""
from __future__ import annotations

from . import register


def type_text(text: str) -> None:
    from pynput.keyboard import Controller
    kb = Controller()
    kb.type(text)


def mouse_click(x: int, y: int, button: str = "left") -> None:
    import pyautogui
    pyautogui.click(x, y, button=button)


def mouse_move(x: int, y: int) -> None:
    import pyautogui
    pyautogui.moveTo(x, y, duration=0.1)


def press_keys(keys: list[str]) -> None:
    import pyautogui
    pyautogui.hotkey(*keys)


def scroll(dx: int = 0, dy: int = -3) -> None:
    import pyautogui
    if dx:
        pyautogui.hscroll(dx)
    if dy:
        pyautogui.scroll(dy)


register("type_text",    type_text,   tier="dangerous")
register("mouse_click",  mouse_click, tier="dangerous")
register("mouse_move",   mouse_move,  tier="dangerous")
register("press_keys",   press_keys,  tier="dangerous")
register("scroll",       scroll,      tier="dangerous")

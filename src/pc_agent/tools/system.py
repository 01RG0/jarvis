"""System stats, process management, volume, clipboard, notifications."""
from __future__ import annotations

import os

from . import register


def get_stats() -> dict:
    import psutil
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("C:/")
    net = psutil.net_io_counters()
    return {
        "cpu_pct":    round(psutil.cpu_percent(interval=0.5), 1),
        "ram_pct":    round(mem.percent, 1),
        "ram_used_gb": round(mem.used / 1e9, 2),
        "ram_total_gb": round(mem.total / 1e9, 2),
        "disk_pct":   round(disk.percent, 1),
        "disk_free_gb": round(disk.free / 1e9, 1),
        "net_sent_mb": round(net.bytes_sent / 1e6, 1),
        "net_recv_mb": round(net.bytes_recv / 1e6, 1),
    }


def list_top_processes(n: int = 8) -> list[dict]:
    import psutil
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            procs.append(p.info)
        except Exception:
            pass
    return sorted(procs, key=lambda x: x.get("cpu_percent") or 0, reverse=True)[:n]


def kill_process(name: str) -> bool:
    import psutil
    killed = False
    for p in psutil.process_iter(["name"]):
        try:
            if p.info["name"].lower() == name.lower():
                p.terminate()
                killed = True
        except Exception:
            pass
    return killed


def get_volume() -> float:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from comtypes import CLSCTX_ALL
        import comtypes
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = interface.QueryInterface(IAudioEndpointVolume)
        return round(vol.GetMasterVolumeLevelScalar(), 2)
    except Exception:
        return -1.0


def set_volume(level: float) -> None:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = interface.QueryInterface(IAudioEndpointVolume)
        vol.SetMasterVolumeLevelScalar(max(0.0, min(1.0, level)), None)
    except Exception:
        pass


def mute(state: bool) -> None:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = interface.QueryInterface(IAudioEndpointVolume)
        vol.SetMute(int(state), None)
    except Exception:
        pass


def get_clipboard() -> str:
    try:
        import pyperclip
        return pyperclip.paste()
    except Exception:
        return ""


def set_clipboard(text: str) -> None:
    try:
        import pyperclip
        pyperclip.copy(text)
    except Exception:
        pass


def send_notification(title: str, body: str) -> None:
    try:
        from winotify import Notification, audio
        toast = Notification(app_id="JARVIS", title=title, msg=body, duration="short")
        toast.set_audio(audio.Default, loop=False)
        toast.show()
    except Exception:
        pass


register("get_stats",           get_stats,           tier="safe")
register("list_top_processes",  list_top_processes,  tier="safe")
register("kill_process",        kill_process,        tier="dangerous")
register("get_volume",          get_volume,          tier="safe")
register("set_volume",          set_volume,          tier="medium")
register("mute",                mute,                tier="medium")
register("get_clipboard",       get_clipboard,       tier="safe")
register("set_clipboard",       set_clipboard,       tier="medium")
register("send_notification",   send_notification,   tier="medium")

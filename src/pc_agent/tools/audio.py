"""PC agent audio control tools."""
from __future__ import annotations


def volume_get() -> dict:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        level = round(volume.GetMasterVolumeLevelScalar() * 100)
        muted = bool(volume.GetMute())
        return {"volume": level, "muted": muted}
    except ImportError:
        return {"volume": -1, "muted": False, "error": "pycaw not available"}
    except Exception as e:
        return {"volume": -1, "muted": False, "error": str(e)}


def volume_set(level: int) -> dict:
    level = max(0, min(100, level))
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        volume.SetMasterVolumeLevelScalar(level / 100.0, None)
        return {"volume": level, "ok": True}
    except ImportError:
        return {"ok": False, "error": "pycaw not available"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def volume_mute(mute: bool = True) -> dict:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        volume.SetMute(int(mute), None)
        return {"muted": mute, "ok": True}
    except ImportError:
        return {"ok": False, "error": "pycaw not available"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def media_play_pause() -> dict:
    try:
        import pyautogui
        pyautogui.press("playpause")
        return {"ok": True, "action": "play_pause"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def media_next() -> dict:
    try:
        import pyautogui
        pyautogui.press("nexttrack")
        return {"ok": True, "action": "next_track"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def media_prev() -> dict:
    try:
        import pyautogui
        pyautogui.press("prevtrack")
        return {"ok": True, "action": "prev_track"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

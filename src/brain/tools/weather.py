"""Built-in: current weather via OpenWeatherMap (falls back to wttr.in)."""
import os
import asyncio
import urllib.parse
import urllib.request
import json

from ._base import JarvisTool, ToolResult

TOOL_NAME = "get_weather"
TOOL_DESCRIPTION = "Get current weather for a city — temperature, conditions, humidity"
TOOL_TAGS = ["weather", "temperature", "forecast", "rain", "sunny", "climate", "cold", "hot"]


def _owm(city: str) -> str:
    key = os.environ.get("OPENWEATHER_API_KEY", "")
    if not key:
        raise ValueError("OPENWEATHER_API_KEY not set")
    url = (
        "https://api.openweathermap.org/data/2.5/weather?q="
        + urllib.parse.quote(city)
        + f"&appid={key}&units=metric"
    )
    with urllib.request.urlopen(url, timeout=8) as r:
        d = json.loads(r.read().decode())
    temp = round(d["main"]["temp"])
    feels = round(d["main"]["feels_like"])
    cond = d["weather"][0]["description"].capitalize()
    hum = d["main"]["humidity"]
    name = d["name"]
    return f"{name}: {temp}°C, feels like {feels}°C, {cond}, humidity {hum}%"


def _wttr(city: str) -> str:
    url = f"https://wttr.in/{urllib.parse.quote(city)}?format=j1"
    req = urllib.request.Request(url, headers={"User-Agent": "Jarvis/1.0"})
    with urllib.request.urlopen(req, timeout=8) as r:
        d = json.loads(r.read().decode())
    cur = d["current_condition"][0]
    temp = cur["temp_C"]
    feels = cur["FeelsLikeC"]
    cond = cur["weatherDesc"][0]["value"]
    hum = cur["humidity"]
    return f"{city.title()}: {temp}°C, feels like {feels}°C, {cond}, humidity {hum}%"


class WeatherTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, city: str = "", **kwargs) -> ToolResult:
        if not city:
            return ToolResult(success=False, output="", error="city is required", tool_name=self.name)
        for fn in (_owm, _wttr):
            try:
                return ToolResult(success=True, output=fn(city), tool_name=self.name)
            except Exception:
                continue
        return ToolResult(success=False, output="", error="Weather unavailable", tool_name=self.name)

"""Jarvis runtime tools — auto-generated and built-in capabilities."""
from .web_search import WebSearchTool
from .weather import WeatherTool
from .news import NewsTool
from .wikipedia_tool import WikipediaTool
from .run_python import RunPythonTool
from .read_file import ReadFileTool
from .discord_tool import DiscordTool
from .whatsapp_tool import WhatsAppTool
from .code_exec import CodeExecTool
from .files import FilesTool
from .browser import BrowserTool
from .github_tool import GithubTool
from .youtube_tool import YoutubeTool
from .stocks_tool import StocksTool
from .calendar import CalendarTool
from .smtp_email import SmtpEmailTool
from .smart_home import SmartHomeTool

BUILTIN_TOOLS = [
    WebSearchTool(),
    WeatherTool(),
    NewsTool(),
    WikipediaTool(),
    RunPythonTool(),
    ReadFileTool(),
    DiscordTool(),
    WhatsAppTool(),
    CodeExecTool(),
    FilesTool(),
    BrowserTool(),
    GithubTool(),
    YoutubeTool(),
    StocksTool(),
    CalendarTool(),
    SmtpEmailTool(),
    SmartHomeTool(),
]

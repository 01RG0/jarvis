"""YouTube Transcript Tool for JARVIS."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

from ._base import JarvisTool, ToolResult

try:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
    )
    YOUTUBE_TRANSCRIPT_AVAILABLE = True
except ImportError:
    YOUTUBE_TRANSCRIPT_AVAILABLE = False
    YouTubeTranscriptApi = None  # type: ignore
    TranscriptsDisabled = Exception  # type: ignore
    NoTranscriptFound = Exception  # type: ignore
    VideoUnavailable = Exception  # type: ignore


class YoutubeTool(JarvisTool):
    """Tool to fetch transcripts of YouTube videos."""

    name: str = "youtube_transcript"
    description: str = "Get the transcript of a YouTube video"
    tags: list[str] = ["youtube", "video", "transcript", "caption", "watch", "yt"]

    def _extract_video_id(self, video_id: str, url: str) -> str:
        if video_id.strip():
            return video_id.strip()

        url = url.strip()
        if not url:
            return ""

        # Check standard watch URL or URL with query params
        parsed = urlparse(url)
        if "youtube.com" in parsed.netloc:
            qs = parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                return qs["v"][0]
            # Handle embed or shorts URLs
            match = re.search(r"/(?:embed|shorts|v)/([a-zA-Z0-9_-]{11})", parsed.path)
            if match:
                return match.group(1)
        elif "youtu.be" in parsed.netloc:
            path = parsed.path.lstrip("/")
            if path:
                # Video ID is usually the first component before any query params or slashes
                return path.split("/")[0].split("?")[0]

        # Generic 11-char ID regex fallback if direct URL or token is passed
        match = re.search(r"([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)

        return ""

    def run(self, video_id: str = "", url: str = "", **kwargs: Any) -> ToolResult:
        if not YOUTUBE_TRANSCRIPT_AVAILABLE:
            return ToolResult(
                success=False,
                output="",
                error="youtube-transcript-api is not installed. Install it via 'pip install youtube-transcript-api'.",
                tool_name=self.name,
            )

        extracted_id = self._extract_video_id(video_id=video_id, url=url)
        if not extracted_id:
            return ToolResult(
                success=False,
                output="",
                error="No valid YouTube video ID or URL was provided.",
                tool_name=self.name,
            )

        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(extracted_id)
            full_text = " ".join(item.get("text", "") for item in transcript_list)
            # Normalize whitespace
            full_text = " ".join(full_text.split())
            truncated_text = full_text[:4000]

            return ToolResult(
                success=True,
                output=truncated_text,
                tool_name=self.name,
            )
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
            return ToolResult(
                success=False,
                output="",
                error=f"Transcript not available for video '{extracted_id}': {str(exc)}",
                tool_name=self.name,
            )
        except Exception as exc:
            return ToolResult(
                success=False,
                output="",
                error=f"Failed to fetch transcript: {str(exc)}",
                tool_name=self.name,
            )

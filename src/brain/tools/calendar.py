"""Google Calendar + Gmail tool via Google API."""
from __future__ import annotations

import base64
import os
import pathlib
from email.mime.text import MIMEText

from ._base import JarvisTool, ToolResult

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
]


def _get_credentials():
    creds_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "./data/google_credentials.json")
    token_path  = os.environ.get("GOOGLE_TOKEN_PATH",       "./data/google_token.json")

    if not pathlib.Path(creds_path).exists():
        raise FileNotFoundError(f"Google credentials not found at {creds_path}")

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if pathlib.Path(token_path).exists():
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        fd = os.open(token_path, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(creds.to_json())

    return creds


class CalendarTool(JarvisTool):
    name = "google_calendar"
    description = "Read and create Google Calendar events, send Gmail emails"
    tags = ["calendar", "event", "schedule", "meeting", "email", "gmail", "send", "appointment"]

    def run(
        self,
        action: str = "list",
        title: str = "",
        start: str = "",
        end: str = "",
        to: str = "",
        subject: str = "",
        body: str = "",
        **kwargs,
    ) -> ToolResult:
        try:
            creds = _get_credentials()
        except FileNotFoundError as e:
            return ToolResult(False, "", str(e), self.name)

        from googleapiclient.discovery import build

        try:
            if action == "list":
                svc = build("calendar", "v3", credentials=creds)
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).isoformat()
                result = svc.events().list(
                    calendarId="primary", timeMin=now,
                    maxResults=5, singleEvents=True, orderBy="startTime",
                ).execute()
                events = result.get("items", [])
                if not events:
                    return ToolResult(True, "No upcoming events", tool_name=self.name)
                lines = []
                for e in events:
                    when = e["start"].get("dateTime", e["start"].get("date", ""))
                    lines.append(f"- {e.get('summary', 'No title')} @ {when}")
                return ToolResult(True, "\n".join(lines), tool_name=self.name)

            if action == "create":
                svc = build("calendar", "v3", credentials=creds)
                event = {
                    "summary": title,
                    "start": {"dateTime": start, "timeZone": "UTC"},
                    "end":   {"dateTime": end,   "timeZone": "UTC"},
                }
                created = svc.events().insert(calendarId="primary", body=event).execute()
                return ToolResult(True, f"Created: {created.get('htmlLink','')}", tool_name=self.name)

            if action == "send_email":
                svc = build("gmail", "v1", credentials=creds)
                msg = MIMEText(body)
                msg["to"] = to
                msg["subject"] = subject
                raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
                svc.users().messages().send(userId="me", body={"raw": raw}).execute()
                return ToolResult(True, f"Email sent to {to}", tool_name=self.name)

            return ToolResult(False, "", f"Unknown action: {action}", self.name)

        except Exception as e:
            return ToolResult(False, "", str(e), self.name)

"""Send email via SMTP — uses stdlib only, no extra deps."""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ._base import JarvisTool, ToolResult


class SmtpEmailTool(JarvisTool):
    name = "send_email"
    description = "Send email via SMTP (Gmail app password or any SMTP server)"
    tags = ["email", "send", "smtp", "mail", "message", "notify", "gmail"]

    def run(
        self,
        to: str = "",
        subject: str = "",
        body: str = "",
        html: bool = False,
        **kwargs,
    ) -> ToolResult:
        user = os.environ.get("SMTP_USER", "")
        passwd = os.environ.get("SMTP_PASS", "")
        if not user or not passwd:
            return ToolResult(False, "", "SMTP_USER and SMTP_PASS not set in .env", self.name)
        if not to:
            return ToolResult(False, "", "to is required", self.name)

        host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        port = int(os.environ.get("SMTP_PORT", "587"))

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = user
        msg["To"]      = to
        msg.attach(MIMEText(body, "html" if html else "plain"))

        try:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.login(user, passwd)
                server.sendmail(user, [to], msg.as_string())
            return ToolResult(True, f"Email sent to {to}", tool_name=self.name)
        except smtplib.SMTPException as e:
            return ToolResult(False, "", f"SMTP error: {e}", self.name)
        except Exception as e:
            return ToolResult(False, "", str(e), self.name)

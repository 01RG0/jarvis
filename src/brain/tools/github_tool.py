"""GitHub Tool for JARVIS."""
from __future__ import annotations

import os
from typing import Any

from ._base import JarvisTool, ToolResult

try:
    from github import Github, GithubException
    PYGITHUB_AVAILABLE = True
except ImportError:
    PYGITHUB_AVAILABLE = False
    Github = None  # type: ignore
    GithubException = Exception  # type: ignore


class GithubTool(JarvisTool):
    """Tool to search repositories, read files, and list issues/PRs on GitHub."""

    name: str = "github"
    description: str = "Search GitHub repos, read files, list issues and PRs"
    tags: list[str] = ["github", "repo", "code", "issue", "pr", "pull request", "commit", "git"]

    def run(
        self,
        action: str = "search",
        repo: str = "",
        query: str = "",
        path: str = "",
        issue_number: int = 0,
        **kwargs: Any,
    ) -> ToolResult:
        if not PYGITHUB_AVAILABLE:
            return ToolResult(
                success=False,
                output="",
                error="PyGithub is not installed. Install it via 'pip install PyGithub'.",
                tool_name=self.name,
            )

        token = os.environ.get("GITHUB_TOKEN", "").strip()
        if not token:
            return ToolResult(
                success=False,
                output="",
                error="GITHUB_TOKEN environment variable is not set.",
                tool_name=self.name,
            )

        try:
            client = Github(token)

            if action == "search":
                if not query:
                    return ToolResult(
                        success=False,
                        output="",
                        error="query parameter is required for search action.",
                        tool_name=self.name,
                    )
                repos = client.search_repositories(query)[:5]
                lines: list[str] = []
                for r in repos:
                    lines.append(f"- {r.full_name}: {r.description or 'No description'} (Stars: {r.stargazers_count}, URL: {r.html_url})")
                output_text = "\n".join(lines) if lines else "No repositories found."
                return ToolResult(
                    success=True,
                    output=output_text,
                    tool_name=self.name,
                )

            if not repo:
                return ToolResult(
                    success=False,
                    output="",
                    error=f"repo parameter (e.g. 'owner/repo') is required for '{action}' action.",
                    tool_name=self.name,
                )

            repo_obj = client.get_repo(repo)

            if action == "list_issues":
                issues = repo_obj.get_issues(state="open")[:10]
                lines = []
                for item in issues:
                    item_type = "PR" if item.pull_request else "Issue"
                    lines.append(f"#{item.number} [{item_type}] {item.title} ({item.html_url})")
                output_text = "\n".join(lines) if lines else "No open issues found."
                return ToolResult(
                    success=True,
                    output=output_text,
                    tool_name=self.name,
                )

            elif action == "list_prs":
                prs = repo_obj.get_pulls(state="open")[:10]
                lines = []
                for pr in prs:
                    lines.append(f"#{pr.number} {pr.title} by {pr.user.login} ({pr.html_url})")
                output_text = "\n".join(lines) if lines else "No open pull requests found."
                return ToolResult(
                    success=True,
                    output=output_text,
                    tool_name=self.name,
                )

            elif action == "get_file":
                if not path:
                    return ToolResult(
                        success=False,
                        output="",
                        error="path parameter is required for get_file action.",
                        tool_name=self.name,
                    )
                content_file = repo_obj.get_contents(path)
                if isinstance(content_file, list):
                    return ToolResult(
                        success=False,
                        output="",
                        error=f"Specified path '{path}' is a directory, not a file.",
                        tool_name=self.name,
                    )
                decoded_content = content_file.decoded_content.decode(errors="replace")[:4000]
                return ToolResult(
                    success=True,
                    output=decoded_content,
                    tool_name=self.name,
                )

            else:
                return ToolResult(
                    success=False,
                    output="",
                    error=f"Unsupported action '{action}'. Supported actions: search, list_issues, get_file, list_prs.",
                    tool_name=self.name,
                )

        except GithubException as exc:
            return ToolResult(
                success=False,
                output="",
                error=f"GitHub API error: {exc.data.get('message', str(exc)) if hasattr(exc, 'data') and isinstance(exc.data, dict) else str(exc)}",
                tool_name=self.name,
            )
        except Exception as exc:
            return ToolResult(
                success=False,
                output="",
                error=f"Unexpected error: {str(exc)}",
                tool_name=self.name,
            )

"""Base class every Jarvis tool must follow."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ToolResult:
    success: bool
    output: str
    error: str = ""
    tool_name: str = ""


class JarvisTool(ABC):
    name: str = ""
    description: str = ""
    tags: list[str] = []

    @abstractmethod
    def run(self, **kwargs) -> ToolResult:
        ...

    def matches(self, task: str) -> float:
        """Return 0-1 relevance score for a task description.

        Tags carry more weight than description words — a tag hit means the
        tool was explicitly designed for this category of task.
        """
        task_lower = task.lower()
        task_words = set(task_lower.split())
        tag_hits = sum(2 for t in self.tags if len(t) > 3 and t in task_lower)
        desc_words = [w for w in self.description.lower().split() if len(w) > 4]
        desc_hits = sum(1 for w in desc_words if w in task_words)
        total = tag_hits + desc_hits
        normalizer = max(len(self.tags) * 2, 1)
        return total / normalizer

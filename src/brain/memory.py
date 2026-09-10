import os
import threading

from mem0 import Memory
from memory_config import get_mem0_config

USER_ID = 'jarvis_user'

_memory_instance = None


class JarvisMemory:
    def __init__(self):
        self.memory = Memory.from_config(get_mem0_config())

    def add(self, content: str) -> None:
        self.memory.add(content, user_id=USER_ID)

    def search(self, query: str, limit: int = 5) -> list[str]:
        try:
            raw = self.memory.search(query, filters={'user_id': USER_ID}, limit=limit)
        except TypeError:
            raw = self.memory.search(query, user_id=USER_ID, limit=limit)
        if isinstance(raw, dict):
            items = raw.get('results', [])
        else:
            items = raw or []
        memories = []
        for item in items:
            if isinstance(item, dict):
                mem = item.get('memory')
                if mem:
                    memories.append(mem)
            elif isinstance(item, str):
                memories.append(item)
        return memories

    def get_context(self, query: str, limit: int = 5) -> str:
        results = self.search(query, limit=limit)
        if results:
            return 'Relevant context from memory:\n- ' + '\n- '.join(results)
        return ''

    def update_from_conversation(self, user_input: str, assistant_response: str) -> None:
        content = f'User said: {user_input}\nJarvis responded: {assistant_response}'
        threading.Thread(
            target=self.memory.add,
            args=(content,),
            kwargs={'user_id': USER_ID},
            daemon=True,
        ).start()


def get_memory() -> JarvisMemory:
    global _memory_instance
    if not _memory_instance:
        _memory_instance = JarvisMemory()
    return _memory_instance

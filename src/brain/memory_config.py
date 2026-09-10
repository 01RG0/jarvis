import os
from dotenv import load_dotenv

load_dotenv()


def get_mem0_config() -> dict:
    return {
        "vector_store": {
            "provider": "chroma",
            "config": {
                "collection_name": "jarvis_memory",
                "path": os.environ.get("MEM0_CHROMA_PATH", "./data/mem0_chroma"),
            },
        },
        "llm": {
            "provider": "groq",
            "config": {
                "model": "llama3-8b-8192",
                "api_key": os.environ.get("GROQ_API_KEY", ""),
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": "text-embedding-v3",
                "api_key": os.environ.get("ALIBABA_API_KEY", ""),
                "openai_base_url": os.environ.get("ALIBABA_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
            },
        },
    }

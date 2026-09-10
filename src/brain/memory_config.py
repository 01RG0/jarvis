import os
from dotenv import load_dotenv

load_dotenv()


def get_mem0_config() -> dict:
    # Embedding: prefer Gemini (free tier) over OpenAI — no paid key needed
    embed_model = os.environ.get("MEM0_EMBED_MODEL", "gemini/text-embedding-004")
    embed_key   = os.environ.get("GEMINI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))

    return {
        "vector_store": {
            "provider": "chroma",
            "config": {
                "collection_name": "jarvis_memory",
                "path": os.environ.get("MEM0_CHROMA_PATH", "./data/mem0_chroma"),
            },
        },
        "llm": {
            "provider": "litellm",
            "config": {
                "model": os.environ.get("MEM0_LLM_MODEL", "groq/llama-3.1-8b-instant"),
                "api_key": os.environ.get("GROQ_API_KEY", ""),
            },
        },
        "embedder": {
            "provider": "litellm",
            "config": {
                "model": embed_model,
                "api_key": embed_key,
            },
        },
    }

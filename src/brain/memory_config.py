import os
from dotenv import load_dotenv

load_dotenv()

_llm_model   = os.environ.get("MEM0_LLM_MODEL",   "gemini/gemini-2.5-flash")
_embed_model = os.environ.get("MEM0_EMBED_MODEL",  "gemini/gemini-embedding-001")

# Strip "gemini/" prefix for Mem0's google embedder provider
_embed_model_id = _embed_model.replace("gemini/", "")


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
            "provider": "litellm",
            "config": {
                "model": _llm_model,
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
            },
        },
        "embedder": {
            "provider": "google",
            "config": {
                "model": _embed_model_id,
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
            },
        },
    }

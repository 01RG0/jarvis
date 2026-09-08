import os
from dotenv import load_dotenv

load_dotenv()


def get_mem0_config() -> dict:
    return {
        'vector_store': {
            'provider': 'chroma',
            'config': {
                'collection_name': 'jarvis_memory',
                'path': os.environ.get('MEM0_CHROMA_PATH', './data/mem0_chroma'),
            }
        },
        'llm': {
            'provider': 'litellm',
            'config': {
                'model': os.environ.get('MEM0_LLM_MODEL', 'groq/llama-3.1-8b-instant'),
                'api_key': os.environ.get('GROQ_API_KEY', ''),
            }
        },
        'embedder': {
            'provider': 'litellm',
            'config': {
                'model': os.environ.get('MEM0_EMBED_MODEL', 'openai/text-embedding-3-small'),
                'api_key': os.environ.get('OPENAI_API_KEY', os.environ.get('GROQ_API_KEY', '')),
            }
        }
    }

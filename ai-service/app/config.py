import os
from dotenv import load_dotenv

load_dotenv()


def _clean_env_value(value: str, default: str) -> str:
	"""Strip inline comments/spaces from env values like '1  // note'."""
	if value is None:
		return default

	cleaned = value.split("//", 1)[0].split("#", 1)[0].strip()
	return cleaned if cleaned else default

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")


REDIS_BROKER_DB = _clean_env_value(os.getenv("REDIS_BROKER_DB"), "0")
REDIS_RESULT_DB = _clean_env_value(os.getenv("REDIS_RESULT_DB"), "1")
REDIS_CACHE_DB = _clean_env_value(os.getenv("REDIS_CACHE_DB"), "2")

CELERY_BROKER_URL = f"{REDIS_URL}/{REDIS_BROKER_DB}"
CELERY_RESULT_BACKEND = f"{REDIS_URL}/{REDIS_RESULT_DB}"
CACHE_URL = f"{REDIS_URL}/{REDIS_CACHE_DB}"

QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
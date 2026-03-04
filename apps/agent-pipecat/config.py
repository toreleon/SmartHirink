"""Environment configuration with Pydantic validation."""

from pydantic_settings import BaseSettings
from pydantic import model_validator


class AgentSettings(BaseSettings):
    """Agent environment settings — validated at startup."""

    # Database & Services
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    # STT (Deepgram)
    DEEPGRAM_API_KEY: str

    # LLM (OpenAI)
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str | None = None
    OPENAI_MODEL: str = "gpt-4o"

    # TTS (Deepgram)
    DEEPGRAM_TTS_MODEL: str = "aura-2-thalia-en"

    # Embedding (for RAG)
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # General
    LOG_LEVEL: str = "info"
    API_URL: str = "http://localhost:4000"
    HOST: str = "0.0.0.0"
    PORT: int = 7860

    model_config = {"env_file": ".env", "extra": "ignore"}


_settings: AgentSettings | None = None


def get_settings() -> AgentSettings:
    global _settings
    if _settings is None:
        _settings = AgentSettings()  # type: ignore[call-arg]
    return _settings

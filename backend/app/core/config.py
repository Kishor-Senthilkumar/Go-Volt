from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore", case_sensitive=False)

    # Database — SQLite file path (relative to where uvicorn is launched)
    database_url: str = "sqlite+aiosqlite:///./volt.db"

    # Ollama / LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:1.5b"
    ollama_timeout_seconds: float = 120
    ollama_num_predict: int = 150
    ollama_keep_alive: str = "30m"
    ollama_temperature: float = 0.25
    ollama_tool_iterations: int = 4

    # Open Charge Map
    open_charge_map_api_key: str = ""
    open_charge_map_base_url: str = "https://api.openchargemap.io/v3/poi"
    open_charge_map_timeout_seconds: float = 15

    # Geocoding
    geocoding_base_url: str = "https://nominatim.openstreetmap.org/search"
    geocoding_user_agent: str = "VoltEVAssistant/0.1 (self-hosted; configure contact details)"

    # CORS — allow both local dev ports
    cors_origins: str = "http://localhost:5173,http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
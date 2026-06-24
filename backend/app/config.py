from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    supabase_url: str
    supabase_anon_key: str
    openai_api_key: str = ""
    email_address: str = ""
    email_password: str = ""

    # App config
    app_name: str = "Billetera Digital"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

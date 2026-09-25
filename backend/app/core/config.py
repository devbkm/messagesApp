"""Application settings loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Inbox API"
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    # Required: there is deliberately no default so credentials are never baked into code.
    database_url: PostgresDsn

    # Comma-separated list of origins allowed to call the API from a browser.
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # How long a sign-in lasts before the user has to log in again.
    session_ttl_days: int = Field(default=14, ge=1, le=90)
    # Send the web session cookie only over HTTPS. Defaults to on in production.
    cookie_secure: bool | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def session_cookie_secure(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure


@lru_cache
def get_settings() -> Settings:
    return Settings()

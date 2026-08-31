from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os
import secrets

class Settings(BaseSettings):
    PROJECT_NAME: str = "panda.vault"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development" # "development", "staging", "production"
    
    # Security / Auth
    JWT_SECRET: str = "super-secret-jwt-key-change-in-production-vaultx-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False # Set to True in production with HTTPS
    PEPPER_SECRET: str = "vaultx-pepper-salt-secret-key-2026"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "vaultx"
    POSTGRES_PASSWORD: str = "vaultx_password"
    POSTGRES_DB: str = "vaultx_db"
    DATABASE_URL: Optional[str] = None

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    def validate_security(self) -> None:
        if self.ENVIRONMENT == "production":
            if "change-in-production" in self.JWT_SECRET or len(self.JWT_SECRET) < 32:
                raise ValueError("CRITICAL: Production deployment requires a secure, high-entropy JWT_SECRET (>= 32 chars).")
            self.COOKIE_SECURE = True

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
settings.validate_security()

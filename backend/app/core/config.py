from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Optional, Union
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
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
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

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [orig.strip() for orig in self.BACKEND_CORS_ORIGINS.split(",") if orig.strip()]
        return self.BACKEND_CORS_ORIGINS

    def validate_security(self) -> None:
        if self.ENVIRONMENT == "production":
            if "change-in-production" in self.JWT_SECRET or len(self.JWT_SECRET) < 32:
                raise ValueError("CRITICAL: Production deployment requires a secure, high-entropy JWT_SECRET (>= 32 chars).")
            self.COOKIE_SECURE = True

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            # Automatically adapt standard cloud provider PostgreSQL URLs to asyncpg dialect
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
settings.validate_security()

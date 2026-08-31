from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger("vaultx.db")

class Base(DeclarativeBase):
    pass

# Primary PostgreSQL async engine
primary_db_url = settings.get_database_url()
engine = create_async_engine(
    primary_db_url,
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def init_db():
    """Initializes tables on PostgreSQL, or auto-falls back to local SQLite strictly in development mode."""
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Database connected and tables initialized: {engine.url.render_as_string(hide_password=True)}")
    except Exception as e:
        if settings.ENVIRONMENT == "production":
            logger.critical(f"CRITICAL: Failed to connect to PostgreSQL in production mode: {e}")
            raise ConnectionError(f"Production PostgreSQL unreachable on {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}: {e}")

        logger.warning(f"PostgreSQL unreachable on {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT} ({e}). Falling back to local SQLite database (vaultx.db)...")
        fallback_url = "sqlite+aiosqlite:///./vaultx.db"
        engine = create_async_engine(
            fallback_url,
            echo=False,
            future=True,
            connect_args={"check_same_thread": False}
        )
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Local SQLite fallback database (vaultx.db) initialized successfully.")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import logging

from app.core.config import settings
from app.core.database import init_db, get_db, engine
from app.core.limiter import limiter
from app.api.v1.router import api_router

logger = logging.getLogger("vaultx")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting panda.vault Backend Server...")
    await init_db()
    yield
    logger.info("Shutting down panda.vault Backend Server...")
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="panda.vault Zero-Knowledge Password Manager API",
    version="0.2.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Attach rate limiter to app state and register 429 exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration
origins = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url}: {exc}", exc_info=True)
    
    # Validate origin against allowed whitelist
    req_origin = request.headers.get("origin", "")
    allowed_origin = req_origin if req_origin in origins else (origins[0] if origins else "*")
    
    # Return sanitized error message without leaking internal database or system details
    error_detail = "An internal server error occurred. Please try again later."
    if settings.ENVIRONMENT == "development":
        error_detail = f"Internal server error: {str(exc)}"

    return JSONResponse(
        status_code=500,
        content={"detail": error_detail},
        headers={"Access-Control-Allow-Origin": allowed_origin}
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.api_route("/", methods=["GET", "HEAD"], tags=["Root"])
def root():
    """Root endpoint supporting GET and HEAD health checks."""
    return {
        "status": "ok",
        "service": "panda.vault API"
    }

@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
def health():
    """Dedicated health endpoint supporting GET and HEAD probes."""
    return {
        "status": "healthy"
    }

@app.api_route("/api/health", methods=["GET", "HEAD"], tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Detailed health check endpoint verifying database connectivity.
    """
    db_status = "connected"
    try:
        result = await db.execute(text("SELECT 1"))
        _ = result.scalar()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok" if "unhealthy" not in db_status else "degraded",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "database_engine": engine.name,
        "environment": settings.ENVIRONMENT,
        "phase": "Production Ready"
    }

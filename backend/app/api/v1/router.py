from fastapi import APIRouter
from app.api.v1.endpoints import auth, vault

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(vault.router, prefix="/vault", tags=["Vault"])

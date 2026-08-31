from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class VaultItemCreate(BaseModel):
    item_type: str = Field(default="login", description="Item type: 'login', 'secure_note', 'card', etc.")
    category: Optional[str] = Field(None, max_length=64, description="Optional category/folder name")
    is_favorite: bool = Field(default=False, description="Favorite toggle")
    encrypted_payload: str = Field(..., min_length=1, description="Base64 AES-256-GCM ciphertext payload")
    iv: str = Field(..., min_length=12, max_length=64, description="Base64 12-byte IV")

    @field_validator('item_type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in ['login', 'secure_note', 'card', 'identity', 'custom']:
            return 'login'
        return cleaned

    @field_validator('category')
    @classmethod
    def normalize_category(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip()
        return None

class VaultItemUpdate(BaseModel):
    item_type: Optional[str] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None
    encrypted_payload: str = Field(..., min_length=1, description="Base64 AES-256-GCM ciphertext payload")
    iv: str = Field(..., min_length=12, max_length=64, description="Base64 12-byte IV")
    version: int = Field(..., ge=1, description="Current expected version for optimistic concurrency")

    @field_validator('category')
    @classmethod
    def normalize_category(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip()
        return None

class VaultItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    item_type: str
    category: Optional[str] = None
    is_favorite: bool
    encrypted_payload: str
    iv: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VaultStatsResponse(BaseModel):
    total_items: int
    logins_count: int
    notes_count: int
    favorites_count: int
    categories: List[str]

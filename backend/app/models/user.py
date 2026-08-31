import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False) # Argon2id hash
    
    # Zero-knowledge parameters (optional in phase 2, used in Phase 3)
    user_salt: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    encrypted_vmk: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vmk_iv: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    vault_items = relationship("VaultItem", back_populates="user", cascade="all, delete-orphan")

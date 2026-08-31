from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(
        None,
        min_length=8,
        max_length=128,
        description="Master password (min 8 chars, max 128 chars)"
    )
    auth_key: Optional[str] = Field(
        None,
        min_length=32,
        max_length=128,
        description="Client-side derived Auth Key (AK hex) for Zero-Knowledge auth"
    )
    user_salt: Optional[str] = Field(
        None,
        min_length=16,
        max_length=128,
        description="Optional client-side salt for zero-knowledge key derivation"
    )
    encrypted_vmk: Optional[str] = Field(
        None,
        description="Optional client-side encrypted vault master key"
    )
    vmk_iv: Optional[str] = Field(
        None,
        min_length=8,
        max_length=128,
        description="Optional IV for encrypted VMK"
    )

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @model_validator(mode='after')
    def check_credential_present(self) -> 'UserRegisterRequest':
        if not self.password and not self.auth_key:
            raise ValueError("Either 'password' or 'auth_key' must be provided for registration.")
        return self

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(None, min_length=1, max_length=128)
    auth_key: Optional[str] = Field(None, min_length=1, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @model_validator(mode='after')
    def check_credential_present(self) -> 'UserLoginRequest':
        if not self.password and not self.auth_key:
            raise ValueError("Either 'password' or 'auth_key' must be provided for login.")
        return self

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    is_active: bool
    is_verified: bool
    user_salt: Optional[str] = None
    encrypted_vmk: Optional[str] = None
    vmk_iv: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    email: Optional[str] = None
    user_salt: Optional[str] = None
    encrypted_vmk: Optional[str] = None
    vmk_iv: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: Optional[str] = Field(None, min_length=1, max_length=128)
    current_auth_key: Optional[str] = Field(None, min_length=1, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)
    new_auth_key: Optional[str] = Field(None, min_length=32, max_length=128)
    new_user_salt: Optional[str] = Field(None, min_length=16, max_length=128)
    new_encrypted_vmk: Optional[str] = None
    new_vmk_iv: Optional[str] = Field(None, min_length=8, max_length=128)

    @model_validator(mode='after')
    def validate_password_change(self) -> 'PasswordChangeRequest':
        if not self.current_password and not self.current_auth_key:
            raise ValueError("Current authentication credential required.")
        if not self.new_password and not self.new_auth_key:
            raise ValueError("New authentication credential required.")
        return self

class LoginChallengeRequest(BaseModel):
    email: EmailStr

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

class LoginChallengeResponse(BaseModel):
    user_salt: Optional[str] = None

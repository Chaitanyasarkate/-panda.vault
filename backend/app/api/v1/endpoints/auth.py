from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timezone, timedelta
from uuid import UUID
from typing import Optional
import hmac
import hashlib

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    check_password_needs_rehash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.core.config import settings
from app.core.limiter import limiter
from app.models.user import User
from app.models.session import UserSession
from app.models.audit import AuditLog
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    PasswordChangeRequest,
    LoginChallengeRequest,
    LoginChallengeResponse
)
from app.api.deps import get_current_user, get_current_active_user

router = APIRouter()

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new user with Argon2id password/auth_key hashing and initiates a secure session.
    Plaintext master password is never stored or logged.
    """
    # Check for existing email (case-insensitive)
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash the master credential (auth_key or password) using Argon2id
    credential_to_hash = data.auth_key or data.password
    if not credential_to_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'password' or 'auth_key' must be provided."
        )

    argon2_hash = hash_password(credential_to_hash)

    user = User(
        email=data.email,
        password_hash=argon2_hash,
        user_salt=data.user_salt,
        encrypted_vmk=data.encrypted_vmk,
        vmk_iv=data.vmk_iv,
        is_active=True
    )
    db.add(user)
    await db.flush()

    # Create session record
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user_session = UserSession(
        user_id=user.id,
        refresh_token_hash="pending_generation",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        expires_at=expires_at
    )
    db.add(user_session)
    await db.flush()

    # Generate JWT tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id, user_session.id)
    
    # Store hashed refresh token in session
    user_session.refresh_token_hash = hash_password(refresh_token)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="USER_REGISTER",
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    # Set secure HTTP-only cookies (dynamically configured via settings.COOKIE_SECURE)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="strict",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=settings.COOKIE_SECURE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/v1/auth"
    )

    user_resp = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_resp,
        email=user.email,
        user_salt=user.user_salt,
        encrypted_vmk=user.encrypted_vmk,
        vmk_iv=user.vmk_iv
    )

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and obtain session tokens"
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates user credentials against Argon2id hash with constant-time verification.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    credential_to_verify = data.auth_key or data.password
    if not credential_to_verify:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication credential required."
        )

    # Constant-time comparison to prevent timing attacks
    if not user or not verify_password(credential_to_verify, user.password_hash):
        # Audit failed login attempt
        audit = AuditLog(
            user_id=user.id if user else None,
            action="LOGIN_FAILED",
            ip_address=request.client.host if request.client else None
        )
        db.add(audit)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support."
        )

    # Check if hash needs upgrading
    if check_password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(credential_to_verify)

    # Create new session
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user_session = UserSession(
        user_id=user.id,
        refresh_token_hash="pending_generation",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        expires_at=expires_at
    )
    db.add(user_session)
    await db.flush()

    # Generate JWT tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id, user_session.id)
    
    # Store hashed refresh token in session
    user_session.refresh_token_hash = hash_password(refresh_token)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    # Set secure HTTP-only cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="strict",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=settings.COOKIE_SECURE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/v1/auth"
    )

    user_resp = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_resp,
        email=user.email,
        user_salt=user.user_salt,
        encrypted_vmk=user.encrypted_vmk,
        vmk_iv=user.vmk_iv
    )

@router.post(
    "/login/challenge",
    response_model=LoginChallengeResponse,
    summary="Obtain user salt for ZK auth with anti-enumeration protection"
)
@limiter.limit("10/minute")
async def login_challenge(
    request: Request,
    data: LoginChallengeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the user's salt for client-side key derivation.
    Mitigates user enumeration by returning a deterministic HMAC-derived pseudo-salt for non-existent users.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if user and user.user_salt:
        return LoginChallengeResponse(user_salt=user.user_salt)
    
    # Deterministic dummy salt generated via HMAC(email, server_pepper) to prevent email enumeration
    dummy_salt = hmac.new(
        settings.PEPPER_SECRET.encode(),
        data.email.encode(),
        hashlib.sha256
    ).hexdigest()[:32]
    
    return LoginChallengeResponse(user_salt=dummy_salt)

@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile")
async def get_me(
    current_user: User = Depends(get_current_active_user)
):
    """Returns profile information for the authenticated user."""
    return UserResponse.model_validate(current_user)

@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token_endpoint(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Rotates access token using validated refresh token from HTTP-only cookie.
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing in request cookies."
        )

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed refresh token claims."
        )

    try:
        user_uuid = UUID(user_id)
        session_uuid = UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid UUID format in token claims."
        )

    # Validate active session in DB
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_uuid,
            UserSession.user_id == user_uuid,
            UserSession.expires_at > datetime.now(timezone.utc)
        )
    )
    user_session = result.scalar_one_or_none()
    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired. Please log in again."
        )

    # Validate user exists and is active
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or not found."
        )

    # Issue new access token
    new_access_token = create_access_token(user.id, user.email)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        samesite="strict",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    user_resp = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_resp,
        email=user.email,
        user_salt=user.user_salt,
        encrypted_vmk=user.encrypted_vmk,
        vmk_iv=user.vmk_iv
    )

@router.post("/logout", summary="Log out and invalidate session")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Invalidates current session from database and removes authentication cookies.
    """
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        payload = decode_token(refresh_token)
        if payload and payload.get("sid"):
            try:
                sid = UUID(payload.get("sid"))
                await db.execute(delete(UserSession).where(UserSession.id == sid))
            except Exception:
                pass

    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_LOGOUT",
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()

    return {"message": "Logged out successfully. Session revoked."}

@router.post("/change-password", summary="Update master password and atomically re-key vault")
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Atomically updates the master password and re-keyed Vault Master Key (VMK).
    Prevents vault lockout in zero-knowledge architecture.
    """
    current_cred = data.current_auth_key or data.current_password
    if not current_cred or not verify_password(current_cred, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current master password verification failed."
        )

    new_cred = data.new_auth_key or data.new_password
    if not new_cred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New authentication credential required."
        )

    current_user.password_hash = hash_password(new_cred)

    # If re-keyed VMK and new salt are provided, update them atomically
    if data.new_user_salt:
        current_user.user_salt = data.new_user_salt
    if data.new_encrypted_vmk:
        current_user.encrypted_vmk = data.new_encrypted_vmk
    if data.new_vmk_iv:
        current_user.vmk_iv = data.new_vmk_iv

    audit = AuditLog(
        user_id=current_user.id,
        action="PASSWORD_CHANGE"
    )
    db.add(audit)
    await db.commit()

    return {"message": "Master password and vault keys updated successfully."}

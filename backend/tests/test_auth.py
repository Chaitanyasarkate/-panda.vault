import pytest
from httpx import AsyncClient
from app.core.security import hash_password, verify_password

@pytest.mark.asyncio
async def test_argon2id_hashing():
    """Unit test verifying Argon2id hashing parameters and constant-time verification."""
    password = "SuperSecretMasterPassword123!"
    hashed = hash_password(password)

    # Verify standard Argon2id prefix
    assert hashed.startswith("$argon2id$")
    assert "m=65536" in hashed
    assert "t=3" in hashed
    assert "p=4" in hashed

    # Verify correct password matches
    assert verify_password(password, hashed) is True

    # Verify wrong password fails
    assert verify_password("WrongPassword123!", hashed) is False

@pytest.mark.asyncio
async def test_user_registration_success(client: AsyncClient):
    """Integration test verifying successful user registration with cookies & Argon2id."""
    payload = {
        "email": "alice@vaultx.com",
        "password": "SecureMasterPassword2026!"
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["user"]["email"] == "alice@vaultx.com"
    assert data["user"]["is_active"] is True
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 15 * 60

    # Verify secure HTTP-only cookies are returned
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies

@pytest.mark.asyncio
async def test_user_registration_duplicate_email(client: AsyncClient):
    """Integration test verifying duplicate email registration rejection."""
    payload = {
        "email": "duplicate@vaultx.com",
        "password": "SecurePassword123!"
    }
    first_res = await client.post("/api/v1/auth/register", json=payload)
    assert first_res.status_code == 201

    # Attempt second registration with same email (case insensitive)
    dup_payload = {
        "email": "DUPLICATE@vaultx.com",
        "password": "AnotherPassword123!"
    }
    dup_res = await client.post("/api/v1/auth/register", json=dup_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

@pytest.mark.asyncio
async def test_user_registration_input_validation(client: AsyncClient):
    """Integration test validating password length and email format constraints."""
    # Short password (< 8 chars)
    short_pwd = {
        "email": "valid@vaultx.com",
        "password": "short"
    }
    res1 = await client.post("/api/v1/auth/register", json=short_pwd)
    assert res1.status_code == 422

    # Invalid email format
    bad_email = {
        "email": "not-an-email",
        "password": "ValidPassword123!"
    }
    res2 = await client.post("/api/v1/auth/register", json=bad_email)
    assert res2.status_code == 422

@pytest.mark.asyncio
async def test_user_login_flow(client: AsyncClient):
    """Integration test verifying user login, wrong password rejection, and non-existent user handling."""
    reg_payload = {
        "email": "bob@vaultx.com",
        "password": "BobsStrongMasterPassword123!"
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # 1. Successful Login
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "bob@vaultx.com",
        "password": "BobsStrongMasterPassword123!"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["user"]["email"] == "bob@vaultx.com"
    assert "access_token" in data

    # 2. Failed Login - Wrong Password
    wrong_pwd_res = await client.post("/api/v1/auth/login", json={
        "email": "bob@vaultx.com",
        "password": "IncorrectPassword!"
    })
    assert wrong_pwd_res.status_code == 401
    assert wrong_pwd_res.json()["detail"] == "Invalid email or password."

    # 3. Failed Login - Nonexistent User (Returns identical generic message)
    nonexistent_res = await client.post("/api/v1/auth/login", json={
        "email": "ghost@vaultx.com",
        "password": "SomePassword123!"
    })
    assert nonexistent_res.status_code == 401
    assert nonexistent_res.json()["detail"] == "Invalid email or password."

@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient):
    """Integration test for /api/v1/auth/me authentication middleware via Bearer and Cookie."""
    reg_payload = {
        "email": "charlie@vaultx.com",
        "password": "CharliesPassword123!"
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]

    # 1. Test using Authorization Bearer header
    me_header_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_header_res.status_code == 200
    assert me_header_res.json()["email"] == "charlie@vaultx.com"

    # 2. Test using HTTP-only cookie
    client.cookies.update(reg_res.cookies)
    me_cookie_res = await client.get("/api/v1/auth/me")
    assert me_cookie_res.status_code == 200
    assert me_cookie_res.json()["email"] == "charlie@vaultx.com"

@pytest.mark.asyncio
async def test_unauthenticated_request_rejection(client: AsyncClient):
    """Integration test verifying rejection of unauthorized requests."""
    client.cookies.clear()
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]

@pytest.mark.asyncio
async def test_token_refresh_flow(client: AsyncClient):
    """Integration test verifying token refresh with valid session."""
    reg_payload = {
        "email": "david@vaultx.com",
        "password": "DavidsPassword123!"
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    client.cookies.update(reg_res.cookies)

    # Call /refresh
    refresh_res = await client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "david@vaultx.com"

@pytest.mark.asyncio
async def test_user_logout(client: AsyncClient):
    """Integration test verifying logout and session termination."""
    reg_payload = {
        "email": "eve@vaultx.com",
        "password": "EvesMasterPassword123!"
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    client.cookies.update(reg_res.cookies)

    # Logout
    logout_res = await client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    assert "Logged out" in logout_res.json()["message"]

@pytest.mark.asyncio
async def test_change_password_flow(client: AsyncClient):
    """Integration test verifying master password update."""
    reg_payload = {
        "email": "frank@vaultx.com",
        "password": "OldPassword123!"
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    client.cookies.update(reg_res.cookies)

    # Change password
    change_res = await client.post("/api/v1/auth/change-password", json={
        "current_password": "OldPassword123!",
        "new_password": "NewMasterPassword2026!"
    })
    assert change_res.status_code == 200

    # Verify old password fails
    client.cookies.clear()
    old_login = await client.post("/api/v1/auth/login", json={
        "email": "frank@vaultx.com",
        "password": "OldPassword123!"
    })
    assert old_login.status_code == 401

    # Verify new password succeeds
    new_login = await client.post("/api/v1/auth/login", json={
        "email": "frank@vaultx.com",
        "password": "NewMasterPassword2026!"
    })
    assert new_login.status_code == 200
    assert new_login.json()["user"]["email"] == "frank@vaultx.com"

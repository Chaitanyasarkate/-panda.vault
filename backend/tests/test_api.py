import pytest
from httpx import AsyncClient
from app.core.config import settings

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert data["service"] == settings.PROJECT_NAME

@pytest.mark.asyncio
async def test_user_registration_and_login_flow(client: AsyncClient):
    # 1. Register User
    reg_payload = {
        "email": "testuser@vaultx.com",
        "password": "StrongPassword123!",
        "user_salt": "0123456789abcdef0123456789abcdef",
        "encrypted_vmk": "encrypted_vmk_base64_string_data==",
        "vmk_iv": "123456789012"
    }

    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["user"]["email"] == "testuser@vaultx.com"
    assert reg_data["user"]["encrypted_vmk"] == reg_payload["encrypted_vmk"]

    # 2. Login Challenge
    challenge_resp = await client.post("/api/v1/auth/login/challenge", json={"email": "testuser@vaultx.com"})
    assert challenge_resp.status_code == 200
    assert challenge_resp.json()["user_salt"] == reg_payload["user_salt"]

    # 3. Login
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "testuser@vaultx.com",
        "password": "StrongPassword123!"
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["user"]["email"] == "testuser@vaultx.com"

@pytest.mark.asyncio
async def test_vault_item_crud(client: AsyncClient):
    # Register & Login
    reg_payload = {
        "email": "vaultuser@vaultx.com",
        "password": "StrongPassword123!",
        "user_salt": "abcdef0123456789abcdef0123456789",
        "encrypted_vmk": "vmk_encrypted_val==",
        "vmk_iv": "123456789012"
    }
    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201

    # Preserve cookies on HTTPX client for session auth
    client.cookies.update(reg_resp.cookies)

    # 1. Create Vault Item
    item_payload = {
        "encrypted_payload": "EncryptedItemPayloadBase64==",
        "iv": "123456789012"
    }
    create_resp = await client.post("/api/v1/vault/items", json=item_payload)
    assert create_resp.status_code == 201
    item_data = create_resp.json()
    item_id = item_data["id"]
    assert item_data["encrypted_payload"] == item_payload["encrypted_payload"]

    # 2. List Vault Items
    list_resp = await client.get("/api/v1/vault/items")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == item_id

    # 3. Update Vault Item
    update_payload = {
        "encrypted_payload": "UpdatedEncryptedItemPayloadBase64==",
        "iv": "123456789012",
        "version": 1
    }
    update_resp = await client.put(f"/api/v1/vault/items/{item_id}", json=update_payload)
    assert update_resp.status_code == 200
    assert update_resp.json()["encrypted_payload"] == update_payload["encrypted_payload"]
    assert update_resp.json()["version"] == 2

    # 4. Delete Vault Item
    del_resp = await client.delete(f"/api/v1/vault/items/{item_id}")
    assert del_resp.status_code == 204

    # Verify empty list
    list_resp2 = await client.get("/api/v1/vault/items")
    assert len(list_resp2.json()) == 0

import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_unauthenticated_vault_access(client: AsyncClient):
    """Verifies that all vault operations require valid authentication."""
    client.cookies.clear()
    random_id = uuid.uuid4()

    # List items
    res1 = await client.get("/api/v1/vault/items")
    assert res1.status_code == 401

    # Create item
    res2 = await client.post("/api/v1/vault/items", json={
        "encrypted_payload": "EncryptedData==",
        "iv": "123456789012"
    })
    assert res2.status_code == 401

    # Get single item
    res3 = await client.get(f"/api/v1/vault/items/{random_id}")
    assert res3.status_code == 401

    # Update item
    res4 = await client.put(f"/api/v1/vault/items/{random_id}", json={
        "encrypted_payload": "EncryptedData==",
        "iv": "123456789012",
        "version": 1
    })
    assert res4.status_code == 401

    # Delete item
    res5 = await client.delete(f"/api/v1/vault/items/{random_id}")
    assert res5.status_code == 401

@pytest.mark.asyncio
async def test_vault_crud_lifecycle(client: AsyncClient):
    """Verifies the complete CRUD lifecycle for credentials and secure notes."""
    # 1. Register & authenticate User
    reg_res = await client.post("/api/v1/auth/register", json={
        "email": "vault_owner@vaultx.com",
        "password": "MasterPassword123!"
    })
    assert reg_res.status_code == 201
    client.cookies.update(reg_res.cookies)

    # 2. Create Credential (Login)
    login_item = {
        "item_type": "login",
        "category": "Personal",
        "is_favorite": True,
        "encrypted_payload": "AES256GCM_EncryptedLoginPayload==",
        "iv": "123456789012"
    }
    create_login_res = await client.post("/api/v1/vault/items", json=login_item)
    assert create_login_res.status_code == 201
    created_login = create_login_res.json()
    login_id = created_login["id"]
    assert created_login["item_type"] == "login"
    assert created_login["category"] == "Personal"
    assert created_login["is_favorite"] is True
    assert created_login["version"] == 1

    # 3. Create Secure Note
    note_item = {
        "item_type": "secure_note",
        "category": "Work",
        "is_favorite": False,
        "encrypted_payload": "AES256GCM_EncryptedNotePayload==",
        "iv": "987654321098"
    }
    create_note_res = await client.post("/api/v1/vault/items", json=note_item)
    assert create_note_res.status_code == 201
    created_note = create_note_res.json()
    note_id = created_note["id"]
    assert created_note["item_type"] == "secure_note"
    assert created_note["category"] == "Work"

    # 4. Read single item
    get_res = await client.get(f"/api/v1/vault/items/{login_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == login_id
    assert get_res.json()["encrypted_payload"] == login_item["encrypted_payload"]

    # 5. List items and test filters
    # All items
    all_res = await client.get("/api/v1/vault/items")
    assert all_res.status_code == 200
    assert len(all_res.json()) == 2

    # Filter by item_type
    only_notes = await client.get("/api/v1/vault/items?item_type=secure_note")
    assert only_notes.status_code == 200
    assert len(only_notes.json()) == 1
    assert only_notes.json()[0]["id"] == note_id

    # Filter by category
    only_work = await client.get("/api/v1/vault/items?category=Work")
    assert only_work.status_code == 200
    assert len(only_work.json()) == 1
    assert only_work.json()[0]["id"] == note_id

    # Filter by is_favorite
    only_favs = await client.get("/api/v1/vault/items?is_favorite=true")
    assert only_favs.status_code == 200
    assert len(only_favs.json()) == 1
    assert only_favs.json()[0]["id"] == login_id

    # 6. Update item
    update_res = await client.put(f"/api/v1/vault/items/{login_id}", json={
        "category": "Finance",
        "is_favorite": False,
        "encrypted_payload": "AES256GCM_UpdatedPayload==",
        "iv": "123456789012",
        "version": 1
    })
    assert update_res.status_code == 200
    assert update_res.json()["category"] == "Finance"
    assert update_res.json()["is_favorite"] is False
    assert update_res.json()["version"] == 2

    # 7. Check vault statistics
    stats_res = await client.get("/api/v1/vault/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_items"] == 2
    assert stats["logins_count"] == 1
    assert stats["notes_count"] == 1
    assert "Finance" in stats["categories"]
    assert "Work" in stats["categories"]

    # 8. Delete item
    del_res = await client.delete(f"/api/v1/vault/items/{login_id}")
    assert del_res.status_code == 204

    # Verify deleted
    get_deleted = await client.get(f"/api/v1/vault/items/{login_id}")
    assert get_deleted.status_code == 404

    remaining_res = await client.get("/api/v1/vault/items")
    assert len(remaining_res.json()) == 1

@pytest.mark.asyncio
async def test_cross_user_access_prevention(client: AsyncClient):
    """
    CRITICAL SECURITY TEST:
    Verifies that User B cannot read, update, or delete User A's vault items.
    """
    # 1. Register User A and create a secret vault item
    user_a_res = await client.post("/api/v1/auth/register", json={
        "email": "user_a@vaultx.com",
        "password": "PasswordA123!"
    })
    client.cookies.update(user_a_res.cookies)

    item_a_res = await client.post("/api/v1/vault/items", json={
        "item_type": "login",
        "category": "SecretA",
        "encrypted_payload": "UserA_ConfidentialPayload==",
        "iv": "123456789012"
    })
    item_a_id = item_a_res.json()["id"]

    # 2. Register User B and authenticate as User B
    client.cookies.clear()
    user_b_res = await client.post("/api/v1/auth/register", json={
        "email": "user_b@vaultx.com",
        "password": "PasswordB123!"
    })
    client.cookies.update(user_b_res.cookies)

    # 3. User B attempts to LIST items -> Should NOT see User A's item
    list_b_res = await client.get("/api/v1/vault/items")
    assert list_b_res.status_code == 200
    assert len(list_b_res.json()) == 0

    # 4. User B attempts to GET User A's item directly -> Should return 404 (Not Found)
    get_a_res = await client.get(f"/api/v1/vault/items/{item_a_id}")
    assert get_a_res.status_code == 404

    # 5. User B attempts to UPDATE User A's item -> Should return 404
    update_a_res = await client.put(f"/api/v1/vault/items/{item_a_id}", json={
        "category": "HackedCategory",
        "encrypted_payload": "MaliciousPayload==",
        "iv": "123456789012",
        "version": 1
    })
    assert update_a_res.status_code == 404

    # 6. User B attempts to DELETE User A's item -> Should return 404
    delete_a_res = await client.delete(f"/api/v1/vault/items/{item_a_id}")
    assert delete_a_res.status_code == 404

    # 7. Re-authenticate as User A and verify item is completely unchanged
    client.cookies.clear()
    client.cookies.update(user_a_res.cookies)
    verify_a_res = await client.get(f"/api/v1/vault/items/{item_a_id}")
    assert verify_a_res.status_code == 200
    assert verify_a_res.json()["encrypted_payload"] == "UserA_ConfidentialPayload=="
    assert verify_a_res.json()["category"] == "SecretA"

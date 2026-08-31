from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, and_
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.vault import VaultItem
from app.models.audit import AuditLog
from app.schemas.vault import (
    VaultItemCreate,
    VaultItemUpdate,
    VaultItemResponse,
    VaultStatsResponse
)
from app.api.deps import get_current_active_user

router = APIRouter()

@router.get("/items", response_model=List[VaultItemResponse], summary="List and filter encrypted vault items")
async def list_vault_items(
    item_type: Optional[str] = Query(None, description="Filter by item type ('login', 'secure_note', 'card')"),
    category: Optional[str] = Query(None, description="Filter by category name"),
    is_favorite: Optional[bool] = Query(None, description="Filter by favorite status"),
    search: Optional[str] = Query(None, description="Search filter for category or type metadata"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all encrypted vault items belonging strictly to the authenticated user.
    All sensitive data remains client-side AES-256-GCM encrypted.
    """
    conditions = [VaultItem.user_id == current_user.id]

    if item_type:
        conditions.append(VaultItem.item_type == item_type.lower())
    if category:
        conditions.append(VaultItem.category == category)
    if is_favorite is not None:
        conditions.append(VaultItem.is_favorite == is_favorite)
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        conditions.append(
            func.lower(VaultItem.category).like(func.lower(search_pattern))
        )

    query = (
        select(VaultItem)
        .where(and_(*conditions))
        .order_by(VaultItem.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    items = result.scalars().all()
    return items

@router.post("/items", response_model=VaultItemResponse, status_code=status.HTTP_201_CREATED, summary="Create encrypted vault item")
async def create_vault_item(
    data: VaultItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Stores a new client-encrypted credential or secure note.
    Backend only stores the ciphertext and initialization vector.
    """
    item = VaultItem(
        user_id=current_user.id,
        item_type=data.item_type,
        category=data.category,
        is_favorite=data.is_favorite,
        encrypted_payload=data.encrypted_payload,
        iv=data.iv,
        version=1
    )
    db.add(item)
    await db.flush()

    audit = AuditLog(
        user_id=current_user.id,
        action="VAULT_ITEM_CREATE"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(item)

    return item

@router.get("/items/{item_id}", response_model=VaultItemResponse, summary="Get single encrypted vault item")
async def get_vault_item(
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves a single encrypted item with strict owner verification.
    Attempts to access another user's item return 404 to prevent resource enumeration.
    """
    result = await db.execute(
        select(VaultItem).where(
            VaultItem.id == item_id,
            VaultItem.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found."
        )
    return item

@router.put("/items/{item_id}", response_model=VaultItemResponse, summary="Update encrypted vault item")
async def update_vault_item(
    item_id: UUID,
    data: VaultItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an encrypted vault item with optimistic concurrency checks.
    """
    result = await db.execute(
        select(VaultItem).where(
            VaultItem.id == item_id,
            VaultItem.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found."
        )

    # Update fields
    if data.item_type is not None:
        item.item_type = data.item_type
    if data.category is not None:
        item.category = data.category
    if data.is_favorite is not None:
        item.is_favorite = data.is_favorite

    item.encrypted_payload = data.encrypted_payload
    item.iv = data.iv
    item.version += 1

    audit = AuditLog(
        user_id=current_user.id,
        action="VAULT_ITEM_UPDATE"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(item)

    return item

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete encrypted vault item")
async def delete_vault_item(
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently deletes an encrypted vault item owned by the authenticated user.
    """
    result = await db.execute(
        select(VaultItem).where(
            VaultItem.id == item_id,
            VaultItem.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found."
        )

    await db.delete(item)

    audit = AuditLog(
        user_id=current_user.id,
        action="VAULT_ITEM_DELETE"
    )
    db.add(audit)
    await db.commit()

    return None

@router.get("/categories", response_model=List[str], summary="List unique categories used in user vault")
async def list_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns a list of distinct category labels used by the user."""
    result = await db.execute(
        select(distinct(VaultItem.category))
        .where(
            VaultItem.user_id == current_user.id,
            VaultItem.category.isnot(None)
        )
    )
    categories = [cat for cat in result.scalars().all() if cat]
    return categories

@router.get("/stats", response_model=VaultStatsResponse, summary="Get vault item statistics and counts")
async def get_vault_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns aggregated count metrics for the user's vault."""
    total_result = await db.execute(
        select(func.count(VaultItem.id)).where(VaultItem.user_id == current_user.id)
    )
    total_items = total_result.scalar() or 0

    logins_result = await db.execute(
        select(func.count(VaultItem.id)).where(
            VaultItem.user_id == current_user.id,
            VaultItem.item_type == "login"
        )
    )
    logins_count = logins_result.scalar() or 0

    notes_result = await db.execute(
        select(func.count(VaultItem.id)).where(
            VaultItem.user_id == current_user.id,
            VaultItem.item_type == "secure_note"
        )
    )
    notes_count = notes_result.scalar() or 0

    favs_result = await db.execute(
        select(func.count(VaultItem.id)).where(
            VaultItem.user_id == current_user.id,
            VaultItem.is_favorite == True
        )
    )
    favorites_count = favs_result.scalar() or 0

    cats_result = await db.execute(
        select(distinct(VaultItem.category))
        .where(
            VaultItem.user_id == current_user.id,
            VaultItem.category.isnot(None)
        )
    )
    categories = [cat for cat in cats_result.scalars().all() if cat]

    return VaultStatsResponse(
        total_items=total_items,
        logins_count=logins_count,
        notes_count=notes_count,
        favorites_count=favorites_count,
        categories=categories
    )

"""Category CRUD + tree + children."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.category import (
    CategoryCreate,
    CategoryDeleteResult,
    CategoryNode,
    CategoryRead,
    CategoryRenameResult,
    CategoryUpdate,
    OrphanReport,
)
from app.services import categories as service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)) -> list[CategoryRead]:
    rows = service.list_categories(db)
    return [CategoryRead.model_validate(row) for row in rows]


@router.get("/tree", response_model=list[CategoryNode])
def get_tree(db: Session = Depends(get_db)) -> list[CategoryNode]:
    return service.build_tree(db)


@router.get("/children", response_model=list[CategoryRead])
def get_children(
    parent_path: str | None = None, db: Session = Depends(get_db)
) -> list[CategoryRead]:
    rows = service.list_children(db, parent_path)
    return [CategoryRead.model_validate(row) for row in rows]


@router.get("/orphans", response_model=OrphanReport)
def get_orphans(db: Session = Depends(get_db)) -> OrphanReport:
    """Items whose ``category_path`` no longer resolves to a category."""
    return service.list_orphaned_items(db)


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)) -> CategoryRead:
    return CategoryRead.model_validate(service.get_category(db, category_id))


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)) -> CategoryRead:
    return CategoryRead.model_validate(service.create_category(db, payload))


@router.patch("/{category_id}", response_model=None)
def update_category(
    category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)
) -> CategoryRenameResult | CategoryRead:
    """Partial update. A changed ``path`` triggers the rename cascade
    and answers with the cascade scope; plain field updates keep the
    classic ``CategoryRead`` response."""
    rename_result: CategoryRenameResult | None = None
    if payload.path is not None:
        rename_result = service.rename_category(db, category_id, payload.path)
    rest = payload.model_dump(exclude_unset=True, exclude={"path"})
    if rest:
        updated = service.update_category(db, category_id, CategoryUpdate(**rest))
        if rename_result is not None:
            rename_result.category = CategoryRead.model_validate(updated)
    if rename_result is not None:
        return rename_result
    return CategoryRead.model_validate(service.get_category(db, category_id))


@router.delete("/{category_id}", response_model=CategoryDeleteResult)
def delete_category(category_id: int, db: Session = Depends(get_db)) -> CategoryDeleteResult:
    return service.delete_category(db, category_id)

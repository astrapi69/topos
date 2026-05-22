"""Category CRUD + tree + children."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.category import (
    CategoryCreate,
    CategoryNode,
    CategoryRead,
    CategoryUpdate,
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


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)) -> CategoryRead:
    return CategoryRead.model_validate(service.get_category(db, category_id))


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)) -> CategoryRead:
    return CategoryRead.model_validate(service.create_category(db, payload))


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)
) -> CategoryRead:
    return CategoryRead.model_validate(service.update_category(db, category_id, payload))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)) -> Response:
    service.delete_category(db, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

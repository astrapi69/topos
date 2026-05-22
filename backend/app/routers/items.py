"""Item CRUD + search."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.services import items as service

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemRead])
def list_items(container_id: int | None = None, db: Session = Depends(get_db)) -> list[ItemRead]:
    rows = service.list_items(db, container_id=container_id)
    return [ItemRead.model_validate(row) for row in rows]


@router.get("/search", response_model=list[ItemRead])
def search_items(q: str, db: Session = Depends(get_db)) -> list[ItemRead]:
    rows = service.search_items(db, q)
    return [ItemRead.model_validate(row) for row in rows]


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, db: Session = Depends(get_db)) -> ItemRead:
    return ItemRead.model_validate(service.get_item(db, item_id))


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)) -> ItemRead:
    return ItemRead.model_validate(service.create_item(db, payload))


@router.patch("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)) -> ItemRead:
    return ItemRead.model_validate(service.update_item(db, item_id, payload))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> Response:
    service.delete_item(db, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Item service."""

from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Container, Item
from app.schemas.item import ItemCreate, ItemUpdate


def list_items(db: Session, container_id: int | None = None) -> list[Item]:
    query = db.query(Item)
    if container_id is not None:
        query = query.filter(Item.container_id == container_id)
    return query.order_by(Item.id).all()


def search_items(db: Session, q: str) -> list[Item]:
    """Substring match over content, category_path, and notes."""
    needle = f"%{q}%"
    return (
        db.query(Item)
        .filter(
            or_(
                Item.content.ilike(needle),
                Item.category_path.ilike(needle),
                Item.notes.ilike(needle),
            )
        )
        .order_by(Item.id)
        .all()
    )


def get_item(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    return item


def create_item(db: Session, payload: ItemCreate) -> Item:
    container = db.get(Container, payload.container_id)
    if container is None:
        raise NotFoundError(f"Container {payload.container_id} not found")
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item(db: Session, item_id: int, payload: ItemUpdate) -> Item:
    item = get_item(db, item_id)
    data = payload.model_dump(exclude_unset=True)
    if "container_id" in data:
        container = db.get(Container, data["container_id"])
        if container is None:
            raise NotFoundError(f"Container {data['container_id']} not found")
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int) -> None:
    item = get_item(db, item_id)
    db.delete(item)
    db.commit()

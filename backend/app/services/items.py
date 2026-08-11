"""Item service."""

from __future__ import annotations

import logging

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models import Category, Container, Item
from app.schemas.item import BulkItemCreate, BulkItemError, ItemCreate, ItemUpdate
from app.services.categories import ensure_category_chain

logger = logging.getLogger(__name__)


def next_external_id(db: Session, container_id: int) -> int:
    """The next free per-container item number ("highest + 1").

    Deliberately not "count + 1": deleting an item must not hand its
    number to a later one, or two entries in the same folder would end
    up carrying the same label on paper.
    """
    highest = (
        db.query(func.max(Item.external_id)).filter(Item.container_id == container_id).scalar()
    )
    return (highest or 0) + 1


def backfill_external_ids(db: Session, items: list[Item]) -> None:
    """Give every unnumbered row a number, in creation order.

    Rows written before the column existed (or by a raw insert) carry
    NULL; numbering them lazily on read means no item stays unnumbered
    without needing a data migration to have run first.
    """
    missing = [item for item in items if item.external_id is None]
    if not missing:
        return
    by_container: dict[int, int] = {}
    for item in sorted(missing, key=lambda row: row.id):
        nxt = by_container.get(item.container_id)
        if nxt is None:
            nxt = next_external_id(db, item.container_id)
        item.external_id = nxt
        by_container[item.container_id] = nxt + 1
    db.commit()


def list_items(db: Session, container_id: int | None = None) -> list[Item]:
    query = db.query(Item)
    if container_id is not None:
        query = query.filter(Item.container_id == container_id)
    items = query.order_by(Item.id).all()
    backfill_external_ids(db, items)
    return items


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
    item.external_id = next_external_id(db, payload.container_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_items_bulk(
    db: Session, rows: list[BulkItemCreate]
) -> tuple[list[Item], list[BulkItemError]]:
    """Insert the valid rows, report the invalid ones - partial success.

    One commit at the end: valid rows persist even when siblings fail,
    which is what a photo-intake staging commit needs (re-submitting a
    whole batch because row 17 lost its container would punish the
    user for a race they cannot see).

    Categories are only created for rows carrying ``new_category_path``,
    i.e. after an explicit user confirmation in the staging UI; plain
    ``category_path`` values are stored as the usual loose reference.

    Args:
        db: Open session.
        rows: The staged rows in user order.

    Returns:
        ``(created_items, row_errors)``; error indices refer to the
        request order.
    """
    created: list[Item] = []
    errors: list[BulkItemError] = []
    container_cache: dict[int, Container | None] = {}
    category_cache: dict[str, Category] = {}
    next_numbers: dict[int, int] = {}
    for index, row in enumerate(rows):
        if row.container_id not in container_cache:
            container_cache[row.container_id] = db.get(Container, row.container_id)
        if container_cache[row.container_id] is None:
            errors.append(
                BulkItemError(index=index, reason=f"Container {row.container_id} not found")
            )
            continue
        content = row.content.strip()
        if not content:
            errors.append(BulkItemError(index=index, reason="content must not be blank"))
            continue
        category_path = (row.category_path or "").strip() or None
        if row.new_category_path and row.new_category_path.strip():
            try:
                category_path = ensure_category_chain(db, row.new_category_path, category_cache)
            except ValidationError as exc:
                # Row-level input problem, not a server fault: report it
                # in the response and keep the rest of the batch alive.
                logger.warning("Bulk item row %d rejected: %s", index, exc.detail)
                errors.append(BulkItemError(index=index, reason=exc.detail))
                continue
        # Number within the batch without a query per row: the first row
        # for a container reads the current highest, the rest count on.
        if row.container_id not in next_numbers:
            next_numbers[row.container_id] = next_external_id(db, row.container_id)
        item = Item(
            container_id=row.container_id,
            external_id=next_numbers[row.container_id],
            content=content,
            priority=row.priority,
            category_path=category_path,
            notes=row.notes,
        )
        next_numbers[row.container_id] += 1
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return created, errors


def update_item(db: Session, item_id: int, payload: ItemUpdate) -> Item:
    item = get_item(db, item_id)
    data = payload.model_dump(exclude_unset=True)
    moved_to: int | None = None
    if "container_id" in data:
        container = db.get(Container, data["container_id"])
        if container is None:
            raise NotFoundError(f"Container {data['container_id']} not found")
        if data["container_id"] != item.container_id:
            moved_to = data["container_id"]
    for key, value in data.items():
        setattr(item, key, value)
    if moved_to is not None:
        # The number is per container, so it means nothing in the target:
        # take the next free one there instead of carrying a duplicate in.
        item.external_id = next_external_id(db, moved_to)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int) -> None:
    item = get_item(db, item_id)
    db.delete(item)
    db.commit()

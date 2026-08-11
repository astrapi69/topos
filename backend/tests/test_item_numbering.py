"""Per-container item numbers ("42-3").

Containers carry a user-facing ``external_id`` ("Nr. 42"); items now
carry one too, counted per container so an entry can be referenced the
way it is found physically: third entry in folder 42 is 42-3.

Assigned automatically, never edited by the user: the service picks the
next free number in the container, and moving an item to another
container re-numbers it there.
"""

from __future__ import annotations

from app.database import SessionLocal
from app.models import Container, ContainerType, Item, Owner
from app.schemas.item import ItemCreate, ItemUpdate
from app.services import items as item_service


def _container(db, external_id: int) -> Container:
    container = Container(
        external_id=external_id,
        type=ContainerType.FOLDER,
        owner=Owner.SELF,
        label=f"Folder {external_id}",
    )
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


def test_numbers_start_at_one_per_container():
    db = SessionLocal()
    try:
        first = _container(db, 42)
        second = _container(db, 100)
        a = item_service.create_item(db, ItemCreate(container_id=first.id, content="A"))
        b = item_service.create_item(db, ItemCreate(container_id=first.id, content="B"))
        c = item_service.create_item(db, ItemCreate(container_id=second.id, content="C"))

        assert (a.external_id, b.external_id) == (1, 2)
        # Each container counts on its own.
        assert c.external_id == 1
    finally:
        db.close()


def test_number_is_reused_after_the_highest_item_is_deleted():
    """Numbers follow "highest + 1", so a gap in the middle stays a gap
    rather than being handed out twice."""
    db = SessionLocal()
    try:
        container = _container(db, 7)
        first = item_service.create_item(db, ItemCreate(container_id=container.id, content="A"))
        second = item_service.create_item(db, ItemCreate(container_id=container.id, content="B"))
        item_service.delete_item(db, first.id)

        third = item_service.create_item(db, ItemCreate(container_id=container.id, content="C"))
        assert second.external_id == 2
        assert third.external_id == 3
    finally:
        db.close()


def test_moving_an_item_renumbers_it_in_the_target_container():
    db = SessionLocal()
    try:
        source = _container(db, 1)
        target = _container(db, 2)
        item_service.create_item(db, ItemCreate(container_id=target.id, content="existing"))
        moving = item_service.create_item(db, ItemCreate(container_id=source.id, content="moving"))
        assert moving.external_id == 1

        moved = item_service.update_item(
            db, moving.id, ItemUpdate(container_id=target.id)
        )
        # Target already had 1, so the moved item becomes 2.
        assert moved.container_id == target.id
        assert moved.external_id == 2
    finally:
        db.close()


def test_bulk_create_numbers_every_row():
    db = SessionLocal()
    try:
        container = _container(db, 55)
        from app.schemas.item import BulkItemCreate

        created, errors = item_service.create_items_bulk(
            db,
            [
                BulkItemCreate(container_id=container.id, content="one"),
                BulkItemCreate(container_id=container.id, content="two"),
            ],
        )
        assert errors == []
        assert [row.external_id for row in created] == [1, 2]
    finally:
        db.close()


def test_existing_items_without_a_number_get_one_assigned():
    """Rows written before the column existed (or by a raw insert) are
    backfilled on the next read, so no item stays unnumbered."""
    db = SessionLocal()
    try:
        container = _container(db, 9)
        legacy = Item(container_id=container.id, content="legacy", external_id=None)
        db.add(legacy)
        db.commit()

        listed = item_service.list_items(db, container_id=container.id)
        assert all(row.external_id is not None for row in listed)
        assert listed[0].external_id == 1
    finally:
        db.close()

"""Container model tests.

Covers the SQLAlchemy mapping, default column values, the
``items`` relationship, and the unique constraint on
``external_id``.
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Container, ContainerType, Item, Owner, Priority


def test_create_container_with_required_fields():
    db = SessionLocal()
    try:
        container = Container(
            external_id=1001,
            type=ContainerType.FOLDER,
            owner=Owner.SELF,
            label="Folder 1001",
        )
        db.add(container)
        db.commit()
        db.refresh(container)
        assert container.id is not None
        assert container.external_id == 1001
        assert container.type == ContainerType.FOLDER
        assert container.owner == Owner.SELF
        assert container.label == "Folder 1001"
        assert container.description is None
        assert container.location is None
        assert container.size_group is None
        assert container.created_at is not None
        assert container.updated_at is not None
    finally:
        db.close()


def test_container_items_relationship_cascades():
    """Deleting a container deletes its items via cascade."""
    db = SessionLocal()
    try:
        container = Container(
            external_id=1002,
            type=ContainerType.FOLDER,
            owner=Owner.SELF,
            label="Folder 1002",
        )
        container.items = [
            Item(content="Item A", priority=Priority.LOW),
            Item(content="Item B", priority=Priority.HIGH),
        ]
        db.add(container)
        db.commit()
        cid = container.id
        assert len(container.items) == 2

        db.delete(container)
        db.commit()
        assert db.query(Item).filter(Item.container_id == cid).count() == 0
    finally:
        db.close()


def test_container_external_id_is_unique():
    db = SessionLocal()
    try:
        db.add(
            Container(
                external_id=2000,
                type=ContainerType.BOX,
                owner=Owner.SELF,
                label="Box 2000",
            )
        )
        db.commit()
        db.add(
            Container(
                external_id=2000,
                type=ContainerType.BOX,
                owner=Owner.SELF,
                label="Duplicate 2000",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        db.close()


def test_container_type_and_owner_enums_persist():
    db = SessionLocal()
    try:
        db.add(
            Container(
                external_id=3000,
                type=ContainerType.BOX,
                owner=Owner.PARENTS,
                label="Eltern-Box",
                location="basement",
                size_group="3000 bis 3099",
            )
        )
        db.commit()
        c = db.query(Container).filter(Container.external_id == 3000).one()
        assert c.type == ContainerType.BOX
        assert c.owner == Owner.PARENTS
        assert c.location == "basement"
        assert c.size_group == "3000 bis 3099"
    finally:
        db.close()

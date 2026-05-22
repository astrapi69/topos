"""Item model tests.

Covers required fields, the ``Priority.NONE`` default, the
parent/child relationship to ``Container``, and the actions
relationship cascade.
"""

from __future__ import annotations

from app.database import SessionLocal
from app.models import Action, ActionStatus, Container, ContainerType, Item, Owner, Priority


def _make_container(db, external_id: int = 100):
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


def test_create_item_minimum_fields_defaults_priority_to_none():
    db = SessionLocal()
    try:
        container = _make_container(db)
        item = Item(container_id=container.id, content="A line of content")
        db.add(item)
        db.commit()
        db.refresh(item)
        assert item.id is not None
        assert item.priority == Priority.NONE
        assert item.category_path is None
        assert item.notes is None
    finally:
        db.close()


def test_item_back_references_container():
    db = SessionLocal()
    try:
        container = _make_container(db, external_id=200)
        item = Item(
            container_id=container.id,
            content="Some content",
            priority=Priority.HIGH,
            category_path="finance/bank",
            notes="optional note",
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        assert item.container.id == container.id
        assert item.container.external_id == 200
    finally:
        db.close()


def test_item_actions_cascade_on_delete():
    db = SessionLocal()
    try:
        container = _make_container(db, external_id=300)
        item = Item(container_id=container.id, content="Content with actions")
        item.actions = [
            Action(text="action 1", status=ActionStatus.OPEN),
            Action(text="action 2", status=ActionStatus.DONE),
        ]
        db.add(item)
        db.commit()
        iid = item.id
        assert len(item.actions) == 2

        db.delete(item)
        db.commit()
        assert db.query(Action).filter(Action.item_id == iid).count() == 0
    finally:
        db.close()

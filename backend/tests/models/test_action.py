"""Action model tests.

Covers default status ``OPEN``, the ``item`` back-reference, and
that ``status``/``due_date``/``completed_at`` update independently.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import Action, ActionStatus, Container, ContainerType, Item, Owner


def _seed_item(db, external_id: int = 1000):
    container = Container(
        external_id=external_id,
        type=ContainerType.FOLDER,
        owner=Owner.SELF,
        label=f"Folder {external_id}",
    )
    db.add(container)
    db.commit()
    item = Item(container_id=container.id, content="Some content")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def test_create_action_defaults_to_open():
    db = SessionLocal()
    try:
        item = _seed_item(db)
        action = Action(item_id=item.id, text="review and possibly cancel")
        db.add(action)
        db.commit()
        db.refresh(action)
        assert action.id is not None
        assert action.status == ActionStatus.OPEN
        assert action.due_date is None
        assert action.completed_at is None
        assert action.created_at is not None
    finally:
        db.close()


def test_action_back_references_item():
    db = SessionLocal()
    try:
        item = _seed_item(db, external_id=1100)
        action = Action(item_id=item.id, text="check meter reading")
        db.add(action)
        db.commit()
        db.refresh(action)
        assert action.item.id == item.id
        assert action.item.content == "Some content"
    finally:
        db.close()


def test_action_status_lifecycle():
    db = SessionLocal()
    try:
        item = _seed_item(db, external_id=1200)
        due = datetime.utcnow() + timedelta(days=30)
        completed = datetime.utcnow()
        action = Action(
            item_id=item.id,
            text="request statement",
            status=ActionStatus.OPEN,
            due_date=due,
        )
        db.add(action)
        db.commit()

        action.status = ActionStatus.DONE
        action.completed_at = completed
        db.commit()
        db.refresh(action)
        assert action.status == ActionStatus.DONE
        assert action.completed_at == completed
        assert action.due_date == due
    finally:
        db.close()

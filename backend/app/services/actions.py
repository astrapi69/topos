"""Action service."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Action, ActionStatus, Item
from app.schemas.action import ActionCreate, ActionUpdate


def list_actions(db: Session, status: ActionStatus | None = None) -> list[Action]:
    query = db.query(Action)
    if status is not None:
        query = query.filter(Action.status == status)
    return query.order_by(Action.id).all()


def get_action(db: Session, action_id: int) -> Action:
    action = db.get(Action, action_id)
    if action is None:
        raise NotFoundError(f"Action {action_id} not found")
    return action


def create_action(db: Session, payload: ActionCreate) -> Action:
    item = db.get(Item, payload.item_id)
    if item is None:
        raise NotFoundError(f"Item {payload.item_id} not found")
    action = Action(**payload.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def update_action(db: Session, action_id: int, payload: ActionUpdate) -> Action:
    action = get_action(db, action_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(action, key, value)
    db.commit()
    db.refresh(action)
    return action


def delete_action(db: Session, action_id: int) -> None:
    action = get_action(db, action_id)
    db.delete(action)
    db.commit()


def complete_action(db: Session, action_id: int) -> Action:
    action = get_action(db, action_id)
    action.status = ActionStatus.DONE
    action.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(action)
    return action


def reopen_action(db: Session, action_id: int) -> Action:
    action = get_action(db, action_id)
    action.status = ActionStatus.OPEN
    action.completed_at = None
    db.commit()
    db.refresh(action)
    return action

"""Action CRUD + complete + reopen."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionStatus
from app.schemas.action import ActionCreate, ActionRead, ActionUpdate
from app.services import actions as service

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=list[ActionRead])
def list_actions(
    status: ActionStatus | None = None, db: Session = Depends(get_db)
) -> list[ActionRead]:
    rows = service.list_actions(db, status=status)
    return [ActionRead.model_validate(row) for row in rows]


@router.get("/{action_id}", response_model=ActionRead)
def get_action(action_id: int, db: Session = Depends(get_db)) -> ActionRead:
    return ActionRead.model_validate(service.get_action(db, action_id))


@router.post("", response_model=ActionRead, status_code=201)
def create_action(payload: ActionCreate, db: Session = Depends(get_db)) -> ActionRead:
    return ActionRead.model_validate(service.create_action(db, payload))


@router.patch("/{action_id}", response_model=ActionRead)
def update_action(
    action_id: int, payload: ActionUpdate, db: Session = Depends(get_db)
) -> ActionRead:
    return ActionRead.model_validate(service.update_action(db, action_id, payload))


@router.delete("/{action_id}", status_code=204)
def delete_action(action_id: int, db: Session = Depends(get_db)) -> Response:
    service.delete_action(db, action_id)
    return Response(status_code=204)


@router.post("/{action_id}/complete", response_model=ActionRead)
def complete_action(action_id: int, db: Session = Depends(get_db)) -> ActionRead:
    return ActionRead.model_validate(service.complete_action(db, action_id))


@router.post("/{action_id}/reopen", response_model=ActionRead)
def reopen_action(action_id: int, db: Session = Depends(get_db)) -> ActionRead:
    return ActionRead.model_validate(service.reopen_action(db, action_id))

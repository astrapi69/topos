from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.action import ActionStatus


class ActionCreate(BaseModel):
    item_id: int
    text: str
    status: ActionStatus = ActionStatus.OPEN
    due_date: datetime | None = None


class ActionUpdate(BaseModel):
    text: str | None = None
    status: ActionStatus | None = None
    due_date: datetime | None = None


class ActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    text: str
    status: ActionStatus
    due_date: datetime | None
    created_at: datetime
    completed_at: datetime | None

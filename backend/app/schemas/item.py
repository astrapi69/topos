from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.item import Priority


class ItemCreate(BaseModel):
    container_id: int
    content: str
    priority: Priority = Priority.NONE
    category_path: str | None = None
    notes: str | None = None


class ItemUpdate(BaseModel):
    container_id: int | None = None
    content: str | None = None
    priority: Priority | None = None
    category_path: str | None = None
    notes: str | None = None


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    container_id: int
    content: str
    priority: Priority
    category_path: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

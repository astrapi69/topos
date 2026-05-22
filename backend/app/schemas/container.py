from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.container import ContainerType, Owner


class ContainerCreate(BaseModel):
    external_id: int
    type: ContainerType
    owner: Owner
    label: str
    description: str | None = None
    location: str | None = None
    size_group: str | None = None


class ContainerUpdate(BaseModel):
    type: ContainerType | None = None
    owner: Owner | None = None
    label: str | None = None
    description: str | None = None
    location: str | None = None
    size_group: str | None = None


class ContainerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: int
    type: ContainerType
    owner: Owner
    label: str
    description: str | None
    location: str | None
    size_group: str | None
    created_at: datetime
    updated_at: datetime

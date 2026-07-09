from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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


class BulkItemCreate(BaseModel):
    """One staged row of ``POST /items/bulk``.

    Row-level constraints (blank content, unknown container, malformed
    ``new_category_path``) are deliberately NOT Pydantic validators:
    the endpoint reports them per row with partial success instead of
    failing the whole request with a 422.

    Attributes:
        new_category_path: A category path the user EXPLICITLY confirmed
            in the staging UI. Only then does the endpoint create the
            missing chain; raw AI hints never create categories. When
            set, it wins over ``category_path``.
    """

    container_id: int
    content: str
    priority: Priority = Priority.NONE
    category_path: str | None = None
    notes: str | None = None
    new_category_path: str | None = None


class BulkItemsRequest(BaseModel):
    """Body of ``POST /items/bulk``.

    Uncapped by design: item inserts are DB-bound and scale trivially
    (see lessons-learned "Bulk-operation limits"). An empty body stays
    a 422 via ``min_length=1``.
    """

    items: list[BulkItemCreate] = Field(min_length=1)


class BulkItemError(BaseModel):
    """Why one row of a bulk request was rejected."""

    index: int
    reason: str


class BulkItemsResult(BaseModel):
    """Partial-success response of ``POST /items/bulk``."""

    created: list[ItemRead]
    errors: list[BulkItemError]

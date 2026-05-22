from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    path: str
    parent_path: str | None = None
    name: str
    display_name: str
    level: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    parent_path: str | None
    name: str
    display_name: str
    level: int


class CategoryNode(BaseModel):
    """A node in the nested category tree returned by ``GET /categories/tree``."""

    model_config = ConfigDict(from_attributes=True)

    path: str
    name: str
    display_name: str
    level: int
    children: list[CategoryNode] = []

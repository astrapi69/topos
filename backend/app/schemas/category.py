from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    path: str
    parent_path: str | None = None
    name: str
    display_name: str
    level: int = 0


class CategoryUpdate(BaseModel):
    """Partial update. Setting ``path`` renames/moves the category and
    cascades the new prefix into every subcategory and every
    ``Item.category_path`` carrying the old prefix."""

    path: str | None = None
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


class CategoryRenameResult(BaseModel):
    """Response of a path-changing PATCH: the cascade's scope."""

    renamed: bool
    items_updated: int
    subcategories_updated: int
    category: CategoryRead


class CategoryDeleteResult(BaseModel):
    """Response of DELETE: how many references were orphaned."""

    deleted: bool
    items_orphaned: int
    subcategories_deleted: int


class CategoryNode(BaseModel):
    """A node in the nested category tree returned by ``GET /categories/tree``."""

    model_config = ConfigDict(from_attributes=True)

    path: str
    name: str
    display_name: str
    level: int
    children: list[CategoryNode] = []

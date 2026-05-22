"""Topos Pydantic schemas.

One module per entity. Create/Update/Read shapes follow the convention
used by sibling PluginForge applications: ``XxxCreate`` for POST,
``XxxUpdate`` for PATCH (all fields optional), ``XxxRead`` for the
serialised DB row.
"""

from app.schemas.action import ActionCreate, ActionRead, ActionUpdate
from app.schemas.category import (
    CategoryCreate,
    CategoryNode,
    CategoryRead,
    CategoryUpdate,
)
from app.schemas.container import ContainerCreate, ContainerRead, ContainerUpdate
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate

__all__ = [
    "ActionCreate",
    "ActionRead",
    "ActionUpdate",
    "CategoryCreate",
    "CategoryNode",
    "CategoryRead",
    "CategoryUpdate",
    "ContainerCreate",
    "ContainerRead",
    "ContainerUpdate",
    "ItemCreate",
    "ItemRead",
    "ItemUpdate",
]

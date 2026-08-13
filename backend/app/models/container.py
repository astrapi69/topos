from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.container_photo import ContainerPhoto
    from app.models.item import Item


class ContainerType(str, Enum):
    """Curated set - extending it is a code change on purpose.

    folder and box are the defaults every install offers; the rest are
    opt-in per device (Settings > Container-Typen). That toggle filters
    which types the FORMS offer, never what the API accepts: rows and
    imports carrying a de-selected type must keep working everywhere.
    Stored as VARCHAR in SQLite (no CHECK constraint), so adding a
    member here needs no migration.
    """

    FOLDER = "folder"
    BOX = "box"
    DRAWER = "drawer"
    SHELF = "shelf"
    CASE = "case"
    SAFE = "safe"


class Owner(str, Enum):
    SELF = "self"
    PARENTS = "parents"
    SHARED = "shared"


class Container(Base):
    """A physical storage container: a file folder, an archive box, a drawer."""

    __tablename__ = "containers"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    type: Mapped[ContainerType] = mapped_column(SAEnum(ContainerType), index=True)
    owner: Mapped[Owner] = mapped_column(SAEnum(Owner), index=True)
    label: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(2000), default=None)
    location: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    size_group: Mapped[str | None] = mapped_column(String(50), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    items: Mapped[list[Item]] = relationship(
        back_populates="container", cascade="all, delete-orphan"
    )
    photos: Mapped[list[ContainerPhoto]] = relationship(
        back_populates="container", cascade="all, delete-orphan"
    )

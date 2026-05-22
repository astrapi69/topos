from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.action import Action
    from app.models.container import Container


class Priority(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class Item(Base):
    """A single inventoried content entry inside a container."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    container_id: Mapped[int] = mapped_column(ForeignKey("containers.id"), index=True)
    content: Mapped[str] = mapped_column(String(1000))
    priority: Mapped[Priority] = mapped_column(SAEnum(Priority), default=Priority.NONE, index=True)
    category_path: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    notes: Mapped[str | None] = mapped_column(String(2000), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    container: Mapped[Container] = relationship(back_populates="items")
    actions: Mapped[list[Action]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.item import Item


class ActionStatus(str, Enum):
    OPEN = "open"
    DONE = "done"
    ARCHIVED = "archived"


class Action(Base):
    """A pending or completed action attached to an item.

    Examples (from the seed Excel): "review and possibly cancel",
    "request statement", "check meter reading".
    """

    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), index=True)
    text: Mapped[str] = mapped_column(String(1000))
    status: Mapped[ActionStatus] = mapped_column(
        SAEnum(ActionStatus), default=ActionStatus.OPEN, index=True
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    item: Mapped[Item] = relationship(back_populates="actions")

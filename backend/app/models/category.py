from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Category(Base):
    """A node in the hierarchical category tree.

    ``path`` is the canonical slash-separated kebab-case English slug
    (e.g. ``"finance/bank/checking-account"``). ``display_name`` is the
    user-facing label (German by default). Display names for other
    languages come from i18n catalogs keyed by ``path``.
    """

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    path: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    parent_path: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    name: Mapped[str] = mapped_column(String(200))
    display_name: Mapped[str] = mapped_column(String(200))
    level: Mapped[int] = mapped_column(Integer, default=0)

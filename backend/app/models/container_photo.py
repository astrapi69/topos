from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.container import Container


class ContainerPhoto(Base):
    """A photo attached to a container (content documentation).

    Two JPEG derivatives live on the filesystem under
    ``<upload_dir>/containers/<container_id>/`` keyed by ``token``:
    ``<token>.jpg`` (downscaled full) and ``<token>_thumb.jpg`` (thumbnail).
    Both are produced client-side (Canvas re-encode, so EXIF is stripped);
    the backend only stores the bytes. Cascade-deletes with the container.
    """

    __tablename__ = "container_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    container_id: Mapped[int] = mapped_column(ForeignKey("containers.id"), index=True)
    # Filename stem (a random hex token), so files are not enumerable by id.
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    mime: Mapped[str] = mapped_column(String(50), default="image/jpeg")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    container: Mapped[Container] = relationship(back_populates="photos")

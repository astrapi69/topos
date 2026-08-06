"""Container photo attachments: filesystem storage + DB rows.

Two client-produced JPEG derivatives per photo live under
``<upload_dir>/containers/<container_id>/``: ``<token>.jpg`` (downscaled full)
and ``<token>_thumb.jpg`` (thumbnail). The backend only stores bytes - all
resizing / EXIF stripping happens client-side (Canvas re-encode).
"""

from __future__ import annotations

import logging
import secrets
from pathlib import Path
from typing import Literal

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models.container import Container
from app.models.container_photo import ContainerPhoto
from app.paths import get_upload_dir
from app.schemas.container_photo import ContainerPhotoRead

logger = logging.getLogger(__name__)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
# Client already downscales to ~300 KB; the cap is a safety net per derivative.
MAX_PHOTO_BYTES = 8 * 1024 * 1024

Variant = Literal["full", "thumb"]


def container_photo_dir(container_id: int) -> Path:
    """Directory holding one container's photo files."""
    return get_upload_dir() / "containers" / str(container_id)


def _variant_path(container_id: int, token: str, variant: Variant) -> Path:
    stem = token if variant == "full" else f"{token}_thumb"
    base = container_photo_dir(container_id).resolve()
    path = (base / f"{stem}.jpg").resolve()
    # Defence in depth: token is DB-generated, but never let a path escape.
    if base not in path.parents:
        raise NotFoundError("Photo path outside its container directory")
    return path


def _to_read(photo: ContainerPhoto) -> ContainerPhotoRead:
    prefix = f"/containers/{photo.container_id}/photos/{photo.id}"
    return ContainerPhotoRead(
        id=photo.id,
        container_id=photo.container_id,
        mime=photo.mime,
        created_at=photo.created_at,
        full_url=f"{prefix}/full",
        thumb_url=f"{prefix}/thumb",
    )


def _require_container(db: Session, container_id: int) -> Container:
    container = db.get(Container, container_id)
    if container is None:
        raise NotFoundError(f"Container {container_id} not found")
    return container


def list_photos(db: Session, container_id: int) -> list[ContainerPhotoRead]:
    _require_container(db, container_id)
    rows = (
        db.query(ContainerPhoto)
        .filter(ContainerPhoto.container_id == container_id)
        .order_by(ContainerPhoto.id)
        .all()
    )
    return [_to_read(row) for row in rows]


def add_photo(
    db: Session,
    container_id: int,
    full_bytes: bytes,
    thumb_bytes: bytes,
    mime: str,
) -> ContainerPhotoRead:
    _require_container(db, container_id)
    if mime not in ALLOWED_MIME:
        raise ValidationError(f"Unsupported image type: {mime}")
    if len(full_bytes) > MAX_PHOTO_BYTES or len(thumb_bytes) > MAX_PHOTO_BYTES:
        raise ValidationError("Photo exceeds the size limit")

    token = secrets.token_hex(16)
    directory = container_photo_dir(container_id)
    directory.mkdir(parents=True, exist_ok=True)
    _variant_path(container_id, token, "full").write_bytes(full_bytes)
    _variant_path(container_id, token, "thumb").write_bytes(thumb_bytes)

    photo = ContainerPhoto(container_id=container_id, token=token, mime=mime)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    logger.info("Added photo %d to container %d", photo.id, container_id)
    return _to_read(photo)


def get_photo_file(db: Session, container_id: int, photo_id: int, variant: Variant) -> Path:
    photo = db.get(ContainerPhoto, photo_id)
    if photo is None or photo.container_id != container_id:
        raise NotFoundError(f"Photo {photo_id} not found")
    path = _variant_path(container_id, photo.token, variant)
    if not path.exists():
        raise NotFoundError(f"Photo file for {photo_id} not found")
    return path


def delete_photo(db: Session, container_id: int, photo_id: int) -> None:
    photo = db.get(ContainerPhoto, photo_id)
    if photo is None or photo.container_id != container_id:
        raise NotFoundError(f"Photo {photo_id} not found")
    for variant in ("full", "thumb"):
        path = _variant_path(container_id, photo.token, variant)  # type: ignore[arg-type]
        path.unlink(missing_ok=True)
    db.delete(photo)
    db.commit()
    logger.info("Deleted photo %d from container %d", photo_id, container_id)


def remove_container_photo_dir(container_id: int) -> None:
    """Best-effort removal of a container's photo directory (on cascade delete)."""
    directory = container_photo_dir(container_id)
    if not directory.exists():
        return
    for child in directory.iterdir():
        child.unlink(missing_ok=True)
    try:
        directory.rmdir()
    except OSError:
        logger.warning("Could not remove photo dir %s", directory)

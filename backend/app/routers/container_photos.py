"""Container photo attachments (multipart upload, serve, delete)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.container_photo import ContainerPhotoRead
from app.services import container_photos as service

router = APIRouter(prefix="/containers", tags=["container-photos"])


@router.get("/{container_id}/photos", response_model=list[ContainerPhotoRead])
def list_photos(container_id: int, db: Session = Depends(get_db)) -> list[ContainerPhotoRead]:
    return service.list_photos(db, container_id)


@router.post(
    "/{container_id}/photos",
    response_model=ContainerPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo(
    container_id: int,
    full: UploadFile = File(...),
    thumb: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ContainerPhotoRead:
    """Store a client-produced full + thumbnail JPEG pair for a container."""
    full_bytes = await full.read()
    thumb_bytes = await thumb.read()
    return service.add_photo(
        db, container_id, full_bytes, thumb_bytes, full.content_type or "image/jpeg"
    )


@router.get("/{container_id}/photos/{photo_id}/full")
def photo_full(container_id: int, photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return FileResponse(
        service.get_photo_file(db, container_id, photo_id, "full"), media_type="image/jpeg"
    )


@router.get("/{container_id}/photos/{photo_id}/thumb")
def photo_thumb(container_id: int, photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return FileResponse(
        service.get_photo_file(db, container_id, photo_id, "thumb"), media_type="image/jpeg"
    )


@router.delete("/{container_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_photo(container_id: int, photo_id: int, db: Session = Depends(get_db)) -> Response:
    service.delete_photo(db, container_id, photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

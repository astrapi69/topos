"""Vision proxy endpoint: photo in, recognized item suggestions out.

Thin router per code-hygiene.md: validate the upload, load the context
(container + existing categories), delegate to ``app.ai.vision``. The
image travels as multipart/form-data - base64-in-JSON would inflate the
payload by a third and trip the body-size middleware on phone photos.

The response is a suggestion list for the staging UI, never an import:
items only reach the database after the user reviewed them
(``POST /api/items/bulk``).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.ai import vision as vision_service
from app.ai.vision_schemas import VisionResult
from app.database import get_db
from app.services import categories as categories_service
from app.services import containers as containers_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/vision", response_model=VisionResult)
async def recognize_container_photo(
    file: UploadFile = File(...),
    container_id: int = Form(...),
    container_type: str = Form(""),
    db: Session = Depends(get_db),
) -> VisionResult:
    """Recognize the items visible on a container photo.

    ``container_id`` is validated up front so a stale id fails fast
    (404) before the AI call costs time and money. ``container_type``
    is optional; it falls back to the stored container's type.
    """
    container = containers_service.get_container(db, container_id)
    effective_type = container_type.strip() or container.type.value
    image_bytes = await file.read()
    media_type = vision_service.validate_image_upload(file.content_type, len(image_bytes))
    category_paths = [row.path for row in categories_service.list_categories(db)]
    return vision_service.recognize_photo(
        image_bytes=image_bytes,
        media_type=media_type,
        container_type=effective_type,
        categories=category_paths,
    )

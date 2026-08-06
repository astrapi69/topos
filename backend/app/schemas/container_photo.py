from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ContainerPhotoRead(BaseModel):
    """A container photo plus the API paths to fetch its two derivatives.

    ``full_url`` / ``thumb_url`` are paths relative to the ``/api`` root (the
    frontend prepends its api base), e.g.
    ``/containers/5/photos/12/full``.
    """

    id: int
    container_id: int
    mime: str
    created_at: datetime
    full_url: str
    thumb_url: str

"""FastAPI route for the Excel-import plugin."""

from __future__ import annotations

from app.database import get_db
from app.exceptions import ValidationError
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .importer import import_workbook

router = APIRouter(prefix="/import", tags=["import"])


class ImportReportResponse(BaseModel):
    """JSON shape of ``POST /import/excel``.

    Mirrors ``importer.ImportReport`` but as a Pydantic model so
    FastAPI can serialize it directly.
    """

    containers_created: int
    containers_updated: int
    items_created: int
    items_updated: int
    items_pruned: int
    actions_created: int
    categories_created: int
    warnings: list[str]


@router.post("/excel", response_model=ImportReportResponse)
async def import_excel(
    file: UploadFile = File(...),
    prune_missing: bool = False,
    db: Session = Depends(get_db),
) -> ImportReportResponse:
    """Import an Ordner-Ordnung.xlsx file.

    With ``prune_missing=False`` (the default), items that exist in
    the DB but no longer appear in the imported sheet for the matched
    container are left alone. Set the flag to delete them.
    """
    payload = await file.read()
    if not payload:
        raise ValidationError("Uploaded file is empty")
    report = import_workbook(db, payload, prune_missing=prune_missing)
    return ImportReportResponse(
        containers_created=report.containers_created,
        containers_updated=report.containers_updated,
        items_created=report.items_created,
        items_updated=report.items_updated,
        items_pruned=report.items_pruned,
        actions_created=report.actions_created,
        categories_created=report.categories_created,
        warnings=report.warnings,
    )

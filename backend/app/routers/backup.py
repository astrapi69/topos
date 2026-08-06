"""Full-data backup export + import."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.backup import BackupImportResult, ToposBackupExport, ToposBackupImport
from app.services import backup as service

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export", response_model=ToposBackupExport)
def export_backup(db: Session = Depends(get_db)) -> ToposBackupExport:
    """Return a consistent snapshot of all four tables as a backup envelope."""
    return service.export_backup(db)


@router.post("/import", response_model=BackupImportResult)
def import_backup(
    payload: ToposBackupImport,
    mode: Literal["merge", "replace"] = Query("merge"),
    db: Session = Depends(get_db),
) -> BackupImportResult:
    """Restore a full Topos backup (merge or replace)."""
    return service.import_backup(db, payload, mode)

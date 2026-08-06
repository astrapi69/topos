from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.action import ActionStatus
from app.models.container import ContainerType, Owner
from app.models.item import Priority
from app.schemas.action import ActionRead
from app.schemas.category import CategoryRead
from app.schemas.container import ContainerRead
from app.schemas.item import ItemRead

# --- Export (GET /api/backup/export) ---


class BackupCounts(BaseModel):
    containers: int = 0
    items: int = 0
    categories: int = 0
    actions: int = 0


class BackupExportData(BaseModel):
    containers: list[ContainerRead]
    items: list[ItemRead]
    categories: list[CategoryRead]
    actions: list[ActionRead]


class ToposBackupExport(BaseModel):
    """The full backup envelope returned by the export endpoint."""

    format: str
    version: int
    exported_at: str
    app_version: str
    build_hash: str
    source: str
    data: BackupExportData
    stats: BackupCounts


# --- Import (POST /api/backup/import?mode=...) ---
#
# The import entity models carry the backup-side ``id`` (+ foreign keys) so the
# service can REMAP relationships onto freshly assigned rows - imported ids are
# never trusted as database ids. Extra keys (timestamps, anything a newer export
# adds) are ignored, so a forward-compatible backup still restores what this
# build understands.


class BackupContainer(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    external_id: int
    type: ContainerType
    owner: Owner
    label: str
    description: str | None = None
    location: str | None = None
    size_group: str | None = None


class BackupItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    container_id: int
    content: str
    priority: Priority = Priority.NONE
    category_path: str | None = None
    notes: str | None = None


class BackupCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")

    path: str
    parent_path: str | None = None
    name: str
    display_name: str
    level: int = 0


class BackupAction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    item_id: int
    text: str
    status: ActionStatus = ActionStatus.OPEN
    due_date: datetime | None = None
    completed_at: datetime | None = None


class BackupImportData(BaseModel):
    containers: list[BackupContainer] = Field(default_factory=list)
    items: list[BackupItem] = Field(default_factory=list)
    categories: list[BackupCategory] = Field(default_factory=list)
    actions: list[BackupAction] = Field(default_factory=list)


class ToposBackupImport(BaseModel):
    """Body of ``POST /api/backup/import``: the full backup envelope."""

    model_config = ConfigDict(extra="ignore")

    format: str
    version: int
    data: BackupImportData


class BackupImportResult(BaseModel):
    """Response of the import endpoint: what landed + per-row warnings."""

    mode: str
    imported: BackupCounts
    errors: list[str] = Field(default_factory=list)

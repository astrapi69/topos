"""Full-data backup export + import (merge / replace) with FK remapping.

A backup is portable across databases, so the backup-side ``id`` values cannot
be trusted as database ids. Import keys containers on ``external_id`` and
categories on ``path`` (their real unique columns), inserts items/actions as
fresh rows, and REMAPS every foreign key (``container_id`` / ``item_id``) from
the backup id onto the freshly assigned database id.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app import __version__
from app.exceptions import ValidationError
from app.models.action import Action
from app.models.category import Category
from app.models.container import Container
from app.models.item import Item
from app.schemas.action import ActionRead
from app.schemas.backup import (
    BackupCounts,
    BackupExportData,
    BackupImportData,
    BackupImportResult,
    ToposBackupExport,
    ToposBackupImport,
)
from app.schemas.category import CategoryRead
from app.schemas.container import ContainerRead
from app.schemas.item import ItemRead

logger = logging.getLogger(__name__)

BACKUP_FORMAT = "topos-backup"
BACKUP_VERSION = 1


def export_backup(db: Session) -> ToposBackupExport:
    """Read all four tables into a single consistent backup envelope."""
    containers = db.query(Container).order_by(Container.id).all()
    items = db.query(Item).order_by(Item.id).all()
    categories = db.query(Category).order_by(Category.id).all()
    actions = db.query(Action).order_by(Action.id).all()

    data = BackupExportData(
        containers=[ContainerRead.model_validate(row) for row in containers],
        items=[ItemRead.model_validate(row) for row in items],
        categories=[CategoryRead.model_validate(row) for row in categories],
        actions=[ActionRead.model_validate(row) for row in actions],
    )
    stats = BackupCounts(
        containers=len(containers),
        items=len(items),
        categories=len(categories),
        actions=len(actions),
    )
    return ToposBackupExport(
        format=BACKUP_FORMAT,
        version=BACKUP_VERSION,
        exported_at=datetime.now(UTC).isoformat(),
        app_version=__version__,
        build_hash="",
        source="backend",
        data=data,
        stats=stats,
    )


def _wipe_all(db: Session) -> None:
    """Delete every row in the four tables (children first)."""
    db.query(Action).delete()
    db.query(Item).delete()
    db.query(Container).delete()
    db.query(Category).delete()
    db.flush()


def _upsert_categories(db: Session, data: BackupImportData) -> int:
    """Insert new categories / overwrite existing ones matched by ``path``."""
    for row in data.categories:
        existing = db.query(Category).filter_by(path=row.path).first()
        if existing is not None:
            existing.parent_path = row.parent_path
            existing.name = row.name
            existing.display_name = row.display_name
            existing.level = row.level
        else:
            db.add(
                Category(
                    path=row.path,
                    parent_path=row.parent_path,
                    name=row.name,
                    display_name=row.display_name,
                    level=row.level,
                )
            )
    db.flush()
    return len(data.categories)


def _upsert_containers(db: Session, data: BackupImportData) -> tuple[int, dict[int, int]]:
    """Upsert containers by ``external_id``; return (count, backup_id -> db_id)."""
    id_map: dict[int, int] = {}
    for row in data.containers:
        existing = db.query(Container).filter_by(external_id=row.external_id).first()
        if existing is not None:
            existing.type = row.type
            existing.owner = row.owner
            existing.label = row.label
            existing.description = row.description
            existing.location = row.location
            existing.size_group = row.size_group
            resolved = existing
        else:
            resolved = Container(
                external_id=row.external_id,
                type=row.type,
                owner=row.owner,
                label=row.label,
                description=row.description,
                location=row.location,
                size_group=row.size_group,
            )
            db.add(resolved)
        db.flush()
        id_map[row.id] = resolved.id

    # Second pass: parent references are backup-file ids and can point
    # at a container that appears LATER in the list, so they can only be
    # remapped once every container has a target-database id. A parent
    # missing from the backup resolves to top level rather than failing
    # the whole import.
    for row in data.containers:
        resolved_id = id_map[row.id]
        parent_db_id = (
            id_map.get(row.parent_container_id) if row.parent_container_id is not None else None
        )
        db.query(Container).filter(Container.id == resolved_id).update(
            {"parent_container_id": parent_db_id}
        )
    db.flush()
    return len(data.containers), id_map


def _import_items(
    db: Session, data: BackupImportData, container_map: dict[int, int]
) -> tuple[int, dict[int, int], list[str]]:
    """Insert items as fresh rows with remapped ``container_id``."""
    id_map: dict[int, int] = {}
    errors: list[str] = []
    count = 0
    for row in data.items:
        container_id = container_map.get(row.container_id)
        if container_id is None:
            errors.append(f"item {row.id}: references unknown container {row.container_id}")
            continue
        item = Item(
            container_id=container_id,
            content=row.content,
            priority=row.priority,
            category_path=row.category_path,
            notes=row.notes,
        )
        db.add(item)
        db.flush()
        id_map[row.id] = item.id
        count += 1
    return count, id_map, errors


def _import_actions(
    db: Session, data: BackupImportData, item_map: dict[int, int]
) -> tuple[int, list[str]]:
    """Insert actions as fresh rows with remapped ``item_id``."""
    errors: list[str] = []
    count = 0
    for row in data.actions:
        item_id = item_map.get(row.item_id)
        if item_id is None:
            errors.append(f"action {row.id}: references unknown item {row.item_id}")
            continue
        db.add(
            Action(
                item_id=item_id,
                text=row.text,
                status=row.status,
                due_date=row.due_date,
                completed_at=row.completed_at,
            )
        )
        count += 1
    return count, errors


def import_backup(db: Session, payload: ToposBackupImport, mode: str) -> BackupImportResult:
    """Import a full backup in merge or replace mode. One transaction."""
    if payload.format != BACKUP_FORMAT:
        raise ValidationError(f"Unrecognized backup format: {payload.format!r}")
    if payload.version > BACKUP_VERSION:
        raise ValidationError(f"Unsupported backup version: {payload.version}")
    if mode not in ("merge", "replace"):
        raise ValidationError(f"Unknown import mode: {mode!r}")

    data = payload.data
    if mode == "replace":
        _wipe_all(db)

    categories = _upsert_categories(db, data)
    containers, container_map = _upsert_containers(db, data)
    items, item_map, item_errors = _import_items(db, data, container_map)
    actions, action_errors = _import_actions(db, data, item_map)
    db.commit()

    counts = BackupCounts(
        containers=containers, items=items, categories=categories, actions=actions
    )
    errors = item_errors + action_errors
    logger.info(
        "Backup import (%s): %d containers, %d items, %d categories, %d actions, %d errors",
        mode,
        containers,
        items,
        categories,
        actions,
        len(errors),
    )
    return BackupImportResult(mode=mode, imported=counts, errors=errors)

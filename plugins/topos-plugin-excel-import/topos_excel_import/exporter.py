"""Export Topos data as an import-compatible Excel workbook."""

from __future__ import annotations

from io import BytesIO

import openpyxl
from app.models import ActionStatus, Category, Container, ContainerType, Item, Owner, Priority
from sqlalchemy.orm import Session, selectinload

from .parser import SHEET_BOXEN, SHEET_MEINE_ORDNER, SHEET_ORDNER_ELTERN

OWNER_SHEET_HEADER = [
    "Nr.",
    "Ordner",
    "Inhalt",
    "Prioritaet",
    "Kategorie",
    "Ort",
    "Aktionen",
]
BOX_SHEET_HEADER = ["Nr.", "Box", None, None, "Inhalt", "Kategorie"]

PRIORITY_LABELS = {
    Priority.VERY_HIGH: "sehr hoch",
    Priority.HIGH: "hoch",
    Priority.MEDIUM: "mittel",
    Priority.LOW: "niedrig",
    Priority.NONE: "keine",
}


def _priority_label(priority: Priority | str) -> str:
    if isinstance(priority, str):
        priority = Priority(priority)
    return PRIORITY_LABELS[priority]


def _category_display_path(categories: dict[str, Category], path: str | None) -> str | None:
    if not path:
        return None
    parts = path.split("/")
    display: list[str] = []
    for index in range(len(parts)):
        prefix = "/".join(parts[: index + 1])
        display.append(categories.get(prefix).display_name if prefix in categories else parts[index])
    return " / ".join(display)


def _open_action_texts(container_item) -> str | None:
    texts = [
        action.text
        for action in sorted(container_item.actions, key=lambda row: row.id)
        if action.status == ActionStatus.OPEN
    ]
    return "; ".join(texts) if texts else None


def _write_owner_sheet(
    ws,
    containers: list[Container],
    categories: dict[str, Category],
    *,
    include_location: bool,
    include_actions: bool,
) -> None:
    ws.append(OWNER_SHEET_HEADER)
    for container in containers:
        ws.append(
            [
                container.external_id,
                container.label,
                None,
                None,
                None,
                container.location if include_location else None,
                None,
            ]
        )
        if container.description:
            for line in container.description.splitlines():
                if line.strip():
                    ws.append([None, line.strip()])
        for item in sorted(container.items, key=lambda row: row.id):
            ws.append(
                [
                    None,
                    None,
                    item.content,
                    _priority_label(item.priority),
                    _category_display_path(categories, item.category_path),
                    None,
                    _open_action_texts(item) if include_actions else None,
                ]
            )


def _write_box_sheet(
    ws,
    containers: list[Container],
    categories: dict[str, Category],
) -> None:
    ws.append(BOX_SHEET_HEADER)
    current_size_group: str | None = None
    for container in containers:
        if container.size_group and container.size_group != current_size_group:
            ws.append([container.size_group])
            current_size_group = container.size_group
        ws.append([container.external_id, container.label])
        if container.description:
            for line in container.description.splitlines():
                if line.strip():
                    ws.append([None, line.strip()])
        for item in sorted(container.items, key=lambda row: row.id):
            ws.append(
                [
                    None,
                    None,
                    None,
                    None,
                    item.content,
                    _category_display_path(categories, item.category_path),
                ]
            )


def _autosize(ws) -> None:
    for column_cells in ws.columns:
        letter = column_cells[0].column_letter
        lengths = [len(str(cell.value)) for cell in column_cells if cell.value is not None]
        max_len = max(lengths) if lengths else 0
        ws.column_dimensions[letter].width = min(max(max_len + 2, 10), 60)


def export_workbook(db: Session) -> bytes:
    """Build an ``.xlsx`` workbook from the current Topos database."""
    categories = {row.path: row for row in db.query(Category).order_by(Category.path).all()}
    containers = (
        db.query(Container)
        .options(selectinload(Container.items).selectinload(Item.actions))
        .order_by(Container.external_id)
        .all()
    )
    own_folders = [
        row
        for row in containers
        if row.type == ContainerType.FOLDER and row.owner in (Owner.SELF, Owner.SHARED)
    ]
    parent_folders = [
        row
        for row in containers
        if row.type == ContainerType.FOLDER and row.owner == Owner.PARENTS
    ]
    boxes = [row for row in containers if row.type == ContainerType.BOX]

    wb = openpyxl.Workbook()
    mine = wb.active
    mine.title = SHEET_MEINE_ORDNER
    parents = wb.create_sheet(SHEET_ORDNER_ELTERN)
    box_sheet = wb.create_sheet(SHEET_BOXEN)

    _write_owner_sheet(mine, own_folders, categories, include_location=True, include_actions=True)
    _write_owner_sheet(
        parents, parent_folders, categories, include_location=False, include_actions=False
    )
    _write_box_sheet(box_sheet, boxes, categories)
    for ws in wb.worksheets:
        _autosize(ws)
        ws.freeze_panes = "A2"

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

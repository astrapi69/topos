"""Excel parser for the Ordner-Ordnung.xlsx shape.

Three sheets, distinct semantics:

- ``"Meine Ordner"`` (29 cols): owner=SELF, type=FOLDER. Col 0 is a
  numeric external id; rows with col 0 empty either continue the
  previous container's description (when col 2 is empty and col 1
  is non-empty) or are items belonging to that container.
- ``"Ordner Eltern"`` (4 cols): owner=PARENTS, type=FOLDER. Same
  shape as the first sheet but uses only cols 0-3; no location, no
  actions.
- ``"Boxen"`` (28 cols): owner=SELF, type=BOX. Col 0 either carries a
  numeric box id or a ``"<lo> bis <hi>"`` range header that defines
  the size-group for the following boxes.

The parser is intentionally pure: it converts cells into in-memory
dataclasses (no DB writes). The importer module turns those records
into idempotent upserts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO

import openpyxl

from .mappings import SlugifiedPath, priority_from_german, slugify_category_path

SHEET_MEINE_ORDNER = "Meine Ordner"
SHEET_ORDNER_ELTERN = "Ordner Eltern"
SHEET_BOXEN = "Boxen"

_RANGE_HEADER_RE = re.compile(r"^\s*(\d+)\s+bis\s+(\d+)\s*$", re.IGNORECASE)
_ACTION_SPLIT_RE = re.compile(r"\s*;\s*")
_NEGATIVE_ACTION_VALUES = {"", "keine", "nein", "no", "none"}


@dataclass
class ParsedItem:
    """An item row tied to the most recently seen container row.

    Translation of the Excel category cell happens during parsing so
    the importer can build the ancestor Category chain without
    re-parsing.
    """

    content: str
    priority: str
    notes: str | None
    category_path: str | None
    category_segments: list[tuple[str, str]]
    action_texts: list[str]


@dataclass
class ParsedContainer:
    """One container plus its child items.

    ``description_lines`` accumulates the multi-row description cells
    found beneath the container row.
    """

    external_id: int
    type: str
    owner: str
    label: str
    location: str | None
    size_group: str | None
    description_lines: list[str] = field(default_factory=list)
    items: list[ParsedItem] = field(default_factory=list)

    @property
    def description(self) -> str | None:
        if not self.description_lines:
            return None
        joined = "\n".join(line for line in self.description_lines if line)
        return joined or None


@dataclass
class ParseResult:
    """Aggregated parser output.

    ``warnings`` collects soft issues (unknown priority strings,
    unmapped category segments). The importer surfaces them in the
    HTTP response so callers can spot drift between Excel content
    and the mapping tables.
    """

    containers: list[ParsedContainer] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _cell(row: tuple, index: int) -> object | None:
    if index >= len(row):
        return None
    return row[index]


def _cell_str(row: tuple, index: int) -> str | None:
    value = _cell(row, index)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _cell_int(row: tuple, index: int) -> int | None:
    value = _cell(row, index)
    if value is None:
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, float):
        if value != int(value):
            return None
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(float(text))
        except ValueError:
            return None
    return None


def _split_actions(raw: str | None) -> list[str]:
    if raw is None:
        return []
    if raw.strip().lower() in _NEGATIVE_ACTION_VALUES:
        return []
    parts = [piece.strip() for piece in _ACTION_SPLIT_RE.split(raw)]
    return [piece for piece in parts if piece]


def _build_item(
    content: str,
    priority_cell: str | None,
    category_cell: str | None,
    notes_cell: str | None,
    action_cell: str | None,
    result: ParseResult,
) -> ParsedItem:
    priority, warning = priority_from_german(priority_cell)
    if warning:
        result.warnings.append(warning)
    slug_result: SlugifiedPath | None = slugify_category_path(category_cell)
    if slug_result is not None:
        result.warnings.extend(slug_result.warnings)
    actions = _split_actions(action_cell)
    return ParsedItem(
        content=content,
        priority=priority,
        notes=notes_cell,
        category_path=slug_result.path if slug_result else None,
        category_segments=slug_result.segments if slug_result else [],
        action_texts=actions,
    )


def _parse_owner_sheet(
    ws: openpyxl.worksheet.worksheet.Worksheet,
    *,
    owner: str,
    container_type: str,
    has_location: bool,
    has_actions: bool,
    result: ParseResult,
) -> None:
    """Parse ``Meine Ordner`` / ``Ordner Eltern``: walk top-to-bottom
    tracking the current container, attach item rows and multi-row
    description continuations."""
    current: ParsedContainer | None = None
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    for row in rows:
        external_id = _cell_int(row, 0)
        col1 = _cell_str(row, 1)
        col2 = _cell_str(row, 2)
        col3 = _cell_str(row, 3)
        col4 = _cell_str(row, 4)
        col5 = _cell_str(row, 5) if has_location else None
        col6 = _cell_str(row, 6) if has_actions else None

        if external_id is not None:
            current = ParsedContainer(
                external_id=external_id,
                type=container_type,
                owner=owner,
                label=col1 or f"Container {external_id}",
                location=col5,
                size_group=None,
            )
            result.containers.append(current)
            continue

        if current is None:
            # Stray data before the first container row; ignore but
            # warn so the user sees the parser dropped it.
            if col1 or col2:
                result.warnings.append(
                    f"Skipped row before first container in sheet "
                    f"{ws.title!r}: col1={col1!r} col2={col2!r}"
                )
            continue

        if col2 is not None:
            current.items.append(
                _build_item(
                    content=col2,
                    priority_cell=col3,
                    category_cell=col4,
                    notes_cell=None,
                    action_cell=col6,
                    result=result,
                )
            )
            continue

        if col1 is not None:
            # Description continuation for the current container.
            current.description_lines.append(col1)


def _parse_box_sheet(ws: openpyxl.worksheet.worksheet.Worksheet, *, result: ParseResult) -> None:
    """Parse ``Boxen``: numeric col-0 = new box, ``"<lo> bis <hi>"``
    col-0 = size-group header, blank col-0 with col-4 = item belonging
    to the current box."""
    current_size_group: str | None = None
    current: ParsedContainer | None = None
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    for row in rows:
        col0_int = _cell_int(row, 0)
        col0_str = _cell_str(row, 0)
        col1 = _cell_str(row, 1)
        col4 = _cell_str(row, 4)
        col5 = _cell_str(row, 5)

        if col0_str is not None and col0_int is None:
            match = _RANGE_HEADER_RE.match(col0_str)
            if match is not None:
                current_size_group = f"{match.group(1)} bis {match.group(2)}"
                # Box-range description rows do not become Container records.
                continue
            # Other non-numeric col-0 strings are skipped with a warning.
            if current is None or col4 is None:
                result.warnings.append(
                    f"Skipped non-numeric row in {ws.title!r}: col0={col0_str!r}"
                )
                continue

        if col0_int is not None:
            current = ParsedContainer(
                external_id=col0_int,
                type="box",
                owner="self",
                label=col1 or f"Box {col0_int}",
                location=None,
                size_group=current_size_group,
            )
            result.containers.append(current)
            continue

        if current is None:
            if col4:
                result.warnings.append(
                    f"Skipped item row before first box in {ws.title!r}: col4={col4!r}"
                )
            continue

        if col4 is not None:
            current.items.append(
                _build_item(
                    content=col4,
                    priority_cell=None,
                    category_cell=col5,
                    notes_cell=None,
                    action_cell=None,
                    result=result,
                )
            )


def parse_workbook(source: str | Path | IO[bytes]) -> ParseResult:
    """Parse an Ordner-Ordnung.xlsx file or bytes-like object.

    ``source`` may be a path or a file-like object. The function
    delegates to ``openpyxl.load_workbook`` with ``read_only=True``
    and ``data_only=True`` so formula cells return their cached value
    rather than the formula text.
    """
    result = ParseResult()
    wb = openpyxl.load_workbook(filename=source, read_only=True, data_only=True)
    try:
        if SHEET_MEINE_ORDNER in wb.sheetnames:
            _parse_owner_sheet(
                wb[SHEET_MEINE_ORDNER],
                owner="self",
                container_type="folder",
                has_location=True,
                has_actions=True,
                result=result,
            )
        else:
            result.warnings.append(f"Sheet {SHEET_MEINE_ORDNER!r} not found in workbook")

        if SHEET_ORDNER_ELTERN in wb.sheetnames:
            _parse_owner_sheet(
                wb[SHEET_ORDNER_ELTERN],
                owner="parents",
                container_type="folder",
                has_location=False,
                has_actions=False,
                result=result,
            )

        if SHEET_BOXEN in wb.sheetnames:
            _parse_box_sheet(wb[SHEET_BOXEN], result=result)
    finally:
        wb.close()
    return result

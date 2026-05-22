"""Idempotent import from parsed Excel records into the Topos DB.

Match keys:

- ``Container.external_id`` (declared unique by the model)
- ``Item.(container_id, content)``
- ``Action.(item_id, text)``
- ``Category.path`` (declared unique by the model)

The importer ALWAYS upserts containers, items, and categories. Actions
are inserted when missing but never reset: a previously-completed
``Action`` keeps its ``status`` / ``completed_at`` even when the same
text appears again in the Excel sheet.

When ``prune_missing=True``, items that exist in the DB but not in the
imported sheet for the matched container are deleted. Off by default.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import IO

from app.models import Action, Category, Container, ContainerType, Item, Owner, Priority
from sqlalchemy.orm import Session

from .parser import ParsedContainer, ParseResult, parse_workbook


@dataclass
class ImportReport:
    """Counts + warnings returned to the caller.

    Counts are container-, item-, action-, and category-level; the
    plugin's HTTP layer (``routes.py``) serialises this dataclass into
    a JSON response.
    """

    containers_created: int = 0
    containers_updated: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_pruned: int = 0
    actions_created: int = 0
    categories_created: int = 0
    warnings: list[str] = field(default_factory=list)


def _ancestor_chain(segments: list[tuple[str, str]]) -> list[tuple[str, str, int]]:
    """Expand a per-segment list into one ``(path, display_name, level)``
    triple per ancestor PLUS the leaf.

    ``segments[(finance, Finanzen), (bank, Bank), (girokonto, Girokonto)]``
    becomes
    ``[("finance", "Finanzen", 0), ("finance/bank", "Bank", 1), ...]``.
    """
    out: list[tuple[str, str, int]] = []
    prefix_slugs: list[str] = []
    for level, (slug, display) in enumerate(segments):
        prefix_slugs.append(slug)
        out.append(("/".join(prefix_slugs), display, level))
    return out


def _ensure_categories(
    db: Session,
    segments: list[tuple[str, str]],
    report: ImportReport,
    cache: dict[str, Category],
) -> None:
    """Create every ancestor + leaf Category row for ``segments`` if it
    does not already exist. The ``cache`` is per-import-run so the
    importer issues at most one INSERT per path."""
    if not segments:
        return
    parent_path: str | None = None
    for path, display, level in _ancestor_chain(segments):
        existing = cache.get(path)
        if existing is None:
            existing = db.query(Category).filter(Category.path == path).one_or_none()
        if existing is None:
            existing = Category(
                path=path,
                parent_path=parent_path,
                name=path.rsplit("/", 1)[-1],
                display_name=display,
                level=level,
            )
            db.add(existing)
            db.flush()
            report.categories_created += 1
        cache[path] = existing
        parent_path = path


def _upsert_actions(
    db: Session,
    item: Item,
    action_texts: list[str],
    report: ImportReport,
) -> None:
    """Insert any action text that does not already exist on the item.
    Existing actions are left alone (status/due_date/completed_at
    preserved)."""
    if not action_texts:
        return
    existing = {action.text for action in item.actions}
    for text in action_texts:
        if text in existing:
            continue
        db.add(Action(item_id=item.id, text=text))
        report.actions_created += 1
    db.flush()


def _upsert_container(
    db: Session,
    parsed: ParsedContainer,
    report: ImportReport,
) -> Container:
    container = (
        db.query(Container).filter(Container.external_id == parsed.external_id).one_or_none()
    )
    if container is None:
        container = Container(
            external_id=parsed.external_id,
            type=ContainerType(parsed.type),
            owner=Owner(parsed.owner),
            label=parsed.label,
            description=parsed.description,
            location=parsed.location,
            size_group=parsed.size_group,
        )
        db.add(container)
        db.flush()
        report.containers_created += 1
    else:
        container.type = ContainerType(parsed.type)
        container.owner = Owner(parsed.owner)
        container.label = parsed.label
        container.description = parsed.description
        container.location = parsed.location
        container.size_group = parsed.size_group
        report.containers_updated += 1
    return container


def _upsert_items(
    db: Session,
    container: Container,
    parsed: ParsedContainer,
    report: ImportReport,
    category_cache: dict[str, Category],
    *,
    prune_missing: bool,
) -> None:
    existing_by_content: dict[str, Item] = {item.content: item for item in container.items}
    seen_contents: set[str] = set()
    for parsed_item in parsed.items:
        _ensure_categories(db, parsed_item.category_segments, report, category_cache)
        existing = existing_by_content.get(parsed_item.content)
        if existing is None:
            new_item = Item(
                container_id=container.id,
                content=parsed_item.content,
                priority=Priority(parsed_item.priority),
                category_path=parsed_item.category_path,
                notes=parsed_item.notes,
            )
            db.add(new_item)
            db.flush()
            container.items.append(new_item)
            report.items_created += 1
            _upsert_actions(db, new_item, parsed_item.action_texts, report)
        else:
            existing.priority = Priority(parsed_item.priority)
            existing.category_path = parsed_item.category_path
            existing.notes = parsed_item.notes
            report.items_updated += 1
            _upsert_actions(db, existing, parsed_item.action_texts, report)
        seen_contents.add(parsed_item.content)

    if prune_missing:
        for content, item in existing_by_content.items():
            if content in seen_contents:
                continue
            db.delete(item)
            report.items_pruned += 1


def import_parsed_result(
    db: Session,
    parsed: ParseResult,
    *,
    prune_missing: bool = False,
) -> ImportReport:
    """Run the upsert for an already-parsed workbook.

    Factored out so unit tests can construct a ``ParseResult`` directly
    without going through openpyxl.
    """
    report = ImportReport(warnings=list(parsed.warnings))
    category_cache: dict[str, Category] = {}
    for parsed_container in parsed.containers:
        container = _upsert_container(db, parsed_container, report)
        db.flush()
        _upsert_items(
            db,
            container,
            parsed_container,
            report,
            category_cache,
            prune_missing=prune_missing,
        )
    db.commit()
    return report


def import_workbook(
    db: Session,
    source: str | Path | IO[bytes] | bytes,
    *,
    prune_missing: bool = False,
) -> ImportReport:
    """Parse + import in one call."""
    if isinstance(source, bytes):
        source = BytesIO(source)
    parsed = parse_workbook(source)
    return import_parsed_result(db, parsed, prune_missing=prune_missing)

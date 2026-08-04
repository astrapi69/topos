"""Category service.

The category tree is stored flat (one row per path) with a
``parent_path`` column for navigation. The ``build_tree`` function
materialises a nested ``CategoryNode`` graph for the
``GET /categories/tree`` endpoint.
"""

from __future__ import annotations

import re

from sqlalchemy import String, func, literal, update
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Category, Item
from app.schemas.category import (
    CategoryCreate,
    CategoryDeleteResult,
    CategoryNode,
    CategoryRead,
    CategoryRenameResult,
    CategoryUpdate,
    OrphanedItem,
    OrphanReport,
)

_CATEGORY_SEGMENT_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def list_categories(db: Session) -> list[Category]:
    return db.query(Category).order_by(Category.path).all()


def get_category(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise NotFoundError(f"Category {category_id} not found")
    return category


def get_category_by_path(db: Session, path: str) -> Category:
    category = db.query(Category).filter(Category.path == path).one_or_none()
    if category is None:
        raise NotFoundError(f"Category {path!r} not found")
    return category


def list_children(db: Session, parent_path: str | None) -> list[Category]:
    """Direct children of ``parent_path``. ``None`` returns top-level
    (level == 0) entries."""
    if parent_path is None:
        return (
            db.query(Category).filter(Category.parent_path.is_(None)).order_by(Category.name).all()
        )
    return (
        db.query(Category).filter(Category.parent_path == parent_path).order_by(Category.name).all()
    )


def create_category(db: Session, payload: CategoryCreate) -> Category:
    existing = db.query(Category).filter(Category.path == payload.path).one_or_none()
    if existing is not None:
        raise ConflictError(f"Category {payload.path!r} already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, payload: CategoryUpdate) -> Category:
    category = get_category(db, category_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


def rename_category(db: Session, category_id: int, new_path: str) -> CategoryRenameResult:
    """Rename/move a category and cascade the prefix change.

    Rewrites the category row itself (path, parent_path, name, level),
    every subcategory row under the old prefix, and every
    ``Item.category_path`` that equals the old path or starts with
    ``old_path + "/"``. Item paths are rewritten with prefix
    concatenation (``new || substr(path, len(old)+1)``), NOT with
    ``replace()`` - replace would also rewrite repeated segments deeper
    in the path ("finance/finance" must become "money/finance", not
    "money/money"). ``display_name`` is deliberately untouched: it is
    the user-facing label and independent of the slug.

    Missing ancestors of the new path are auto-created via
    ``ensure_category_chain`` so a move under a new parent works in one
    call.

    Raises:
        ValidationError: On invalid paths or a move into the category's
            own subtree.
        ConflictError: When the target path already exists.
    """
    category = get_category(db, category_id)
    old_path = category.path
    segments = validate_category_path(new_path)
    normalized = "/".join(segments)
    if normalized == old_path:
        return CategoryRenameResult(
            renamed=False,
            items_updated=0,
            subcategories_updated=0,
            category=CategoryRead.model_validate(category),
        )
    if normalized.startswith(old_path + "/"):
        raise ValidationError(f"Cannot move {old_path!r} into its own subtree {normalized!r}")
    existing = db.query(Category).filter(Category.path == normalized).one_or_none()
    if existing is not None:
        raise ConflictError(f"Category {normalized!r} already exists")

    parent_path = "/".join(segments[:-1]) or None
    if parent_path is not None:
        ensure_category_chain(db, parent_path)

    # Subcategory rows: few per tree - rewrite in Python so parent_path
    # and level stay consistent even when the move changes the depth.
    children = db.query(Category).filter(Category.path.like(f"{old_path}/%")).all()
    for child in children:
        child.path = normalized + child.path[len(old_path) :]
        if child.parent_path is not None and (
            child.parent_path == old_path or child.parent_path.startswith(old_path + "/")
        ):
            child.parent_path = normalized + child.parent_path[len(old_path) :]
        child.level = child.path.count("/")

    category.path = normalized
    category.parent_path = parent_path
    category.name = segments[-1]
    category.level = len(segments) - 1

    # Item references: potentially many rows - two bulk UPDATEs.
    exact = db.execute(
        update(Item)
        .where(Item.category_path == old_path)
        .values(category_path=normalized)
        .execution_options(synchronize_session=False)
    )
    prefixed = db.execute(
        update(Item)
        .where(Item.category_path.like(f"{old_path}/%"))
        .values(
            category_path=literal(normalized, String)
            + func.substr(Item.category_path, len(old_path) + 1)
        )
        .execution_options(synchronize_session=False)
    )
    db.commit()
    db.refresh(category)
    return CategoryRenameResult(
        renamed=True,
        items_updated=(exact.rowcount or 0) + (prefixed.rowcount or 0),
        subcategories_updated=len(children),
        category=CategoryRead.model_validate(category),
    )


def delete_category(db: Session, category_id: int) -> CategoryDeleteResult:
    """Delete a category subtree and null out the item references.

    Items are never deleted - their ``category_path`` becomes NULL so
    they show up under "no category" instead of pointing at a path that
    no longer exists.
    """
    category = get_category(db, category_id)
    old_path = category.path

    orphaned = db.execute(
        update(Item)
        .where((Item.category_path == old_path) | (Item.category_path.like(f"{old_path}/%")))
        .values(category_path=None)
        .execution_options(synchronize_session=False)
    )
    children = db.query(Category).filter(Category.path.like(f"{old_path}/%")).all()
    for child in children:
        db.delete(child)
    db.delete(category)
    db.commit()
    return CategoryDeleteResult(
        deleted=True,
        items_orphaned=orphaned.rowcount or 0,
        subcategories_deleted=len(children),
    )


def list_orphaned_items(db: Session) -> OrphanReport:
    """Items whose ``category_path`` is set but matches no ``Category.path``.

    Cascade delete nulls its references, so orphans come from other
    channels: imports carrying unknown paths, free-text edits, or data
    predating the cascade feature.
    """
    known_paths = db.query(Category.path)
    rows = (
        db.query(Item)
        .filter(Item.category_path.isnot(None), ~Item.category_path.in_(known_paths))
        .order_by(Item.category_path, Item.id)
        .all()
    )
    return OrphanReport(
        orphaned_items=[OrphanedItem.model_validate(row) for row in rows],
        count=len(rows),
    )


def validate_category_path(path: str) -> list[str]:
    """Split ``path`` into validated english-kebab-case segments.

    Args:
        path: A slash-separated category path (e.g. ``finance/tax``).

    Returns:
        The path segments.

    Raises:
        ValidationError: On empty paths or segments that are not
            lowercase kebab-case.
    """
    segments = [segment for segment in path.strip().strip("/").split("/") if segment]
    if not segments or any(not _CATEGORY_SEGMENT_RE.match(segment) for segment in segments):
        raise ValidationError(
            f"Invalid category path {path!r} - use english-kebab-case segments separated by '/'"
        )
    return segments


def ensure_category_chain(db: Session, path: str, cache: dict[str, Category] | None = None) -> str:
    """Create every missing ancestor + leaf ``Category`` for ``path``.

    Mirrors the excel-import chain creation: one row per path level,
    ``parent_path`` linked, ``display_name`` derived from the slug
    (the user can rename later). Idempotent - existing rows are reused.

    Args:
        db: Open session; rows are flushed, the caller commits.
        path: Validated via ``validate_category_path``.
        cache: Optional per-request cache to avoid repeated lookups.

    Returns:
        The normalized leaf path.

    Raises:
        ValidationError: When ``path`` is not a valid category path.
    """
    segments = validate_category_path(path)
    chain_cache = cache if cache is not None else {}
    parent_path: str | None = None
    walked: list[str] = []
    for level, segment in enumerate(segments):
        walked.append(segment)
        chain_path = "/".join(walked)
        existing = chain_cache.get(chain_path)
        if existing is None:
            existing = db.query(Category).filter(Category.path == chain_path).one_or_none()
        if existing is None:
            existing = Category(
                path=chain_path,
                parent_path=parent_path,
                name=segment,
                display_name=segment.replace("-", " ").title(),
                level=level,
            )
            db.add(existing)
            db.flush()
        chain_cache[chain_path] = existing
        parent_path = chain_path
    return "/".join(walked)


def build_tree(db: Session) -> list[CategoryNode]:
    """Return all categories as a forest of ``CategoryNode``.

    O(N) over the rows: build the per-path node dict in one pass,
    then link each node into its parent's ``children`` list. Top-
    level (parent_path IS NULL) nodes become the forest roots.
    """
    rows = db.query(Category).order_by(Category.path).all()
    by_path: dict[str, CategoryNode] = {
        row.path: CategoryNode(
            path=row.path,
            name=row.name,
            display_name=row.display_name,
            level=row.level,
            children=[],
        )
        for row in rows
    }
    roots: list[CategoryNode] = []
    for row in rows:
        node = by_path[row.path]
        if row.parent_path is None or row.parent_path not in by_path:
            roots.append(node)
        else:
            by_path[row.parent_path].children.append(node)
    return roots

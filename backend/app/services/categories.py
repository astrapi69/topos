"""Category service.

The category tree is stored flat (one row per path) with a
``parent_path`` column for navigation. The ``build_tree`` function
materialises a nested ``CategoryNode`` graph for the
``GET /categories/tree`` endpoint.
"""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Category
from app.schemas.category import CategoryCreate, CategoryNode, CategoryUpdate

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


def delete_category(db: Session, category_id: int) -> None:
    category = get_category(db, category_id)
    db.delete(category)
    db.commit()


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

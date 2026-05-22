"""Category service.

The category tree is stored flat (one row per path) with a
``parent_path`` column for navigation. The ``build_tree`` function
materialises a nested ``CategoryNode`` graph for the
``GET /categories/tree`` endpoint.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError
from app.models import Category
from app.schemas.category import CategoryCreate, CategoryNode, CategoryUpdate


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

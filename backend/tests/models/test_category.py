"""Category model tests.

Covers the ``path`` unique constraint, default level, and
parent/child semantics expressed via ``parent_path``.
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Category


def test_create_category_with_required_fields():
    db = SessionLocal()
    try:
        cat = Category(
            path="finance",
            name="finance",
            display_name="Finanzen",
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        assert cat.id is not None
        assert cat.parent_path is None
        assert cat.level == 0
        assert cat.display_name == "Finanzen"
    finally:
        db.close()


def test_category_path_is_unique():
    db = SessionLocal()
    try:
        db.add(Category(path="finance/bank", name="bank", display_name="Bank"))
        db.commit()
        db.add(Category(path="finance/bank", name="bank", display_name="Bank 2"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        db.close()


def test_category_parent_child_links_via_path():
    db = SessionLocal()
    try:
        parent = Category(path="finance", name="finance", display_name="Finanzen", level=0)
        child = Category(
            path="finance/bank",
            parent_path="finance",
            name="bank",
            display_name="Bank",
            level=1,
        )
        grandchild = Category(
            path="finance/bank/checking-account",
            parent_path="finance/bank",
            name="checking-account",
            display_name="Girokonto",
            level=2,
        )
        db.add_all([parent, child, grandchild])
        db.commit()

        children = db.query(Category).filter(Category.parent_path == "finance").all()
        assert [c.name for c in children] == ["bank"]
        grandkids = (
            db.query(Category).filter(Category.parent_path == "finance/bank").all()
        )
        assert [c.name for c in grandkids] == ["checking-account"]
    finally:
        db.close()

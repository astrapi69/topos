"""Test helpers for the Excel-import plugin.

The plugin tests run from inside the plugin directory (path-installed
into the backend venv). They need:

- A SQLAlchemy session pointed at an in-memory SQLite DB with the
  Topos schema applied.
- Helpers to build synthetic ``openpyxl`` workbooks matching the
  three-sheet Ordner-Ordnung.xlsx shape.

Both helpers live here so individual test modules stay focused on
the behaviour they exercise.
"""

from __future__ import annotations

import os
from io import BytesIO

# Tests run inside the backend venv (path-dep). Force test mode so
# the backend's database module wires up the in-memory sqlite URL
# instead of touching the production data dir.
os.environ.setdefault("TOPOS_TEST", "1")
os.environ.setdefault("TEST_DATABASE_URL", "sqlite:///:memory:")

import app.models  # noqa: F401, E402  - register mapped classes with Base.metadata
import openpyxl  # noqa: E402
import pytest  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_schema() -> None:
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _write_workbook(sheets: dict[str, list[list]]) -> bytes:
    """Build an in-memory workbook from ``{sheet_name: [[row], ...]}``.

    Each row is a list of cell values; ``None`` cells become empty.
    The first row is treated as the header by the parser, so callers
    should prepend a header row.
    """
    wb = openpyxl.Workbook()
    # Drop the default sheet so we can name our first one freely.
    default = wb.active
    wb.remove(default)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture
def write_workbook():
    return _write_workbook

"""Integration test for ``POST /api/import/excel``.

Asserts the route is mounted by the plugin manager, returns an
``ImportReport`` body, and that the upload pipeline (UploadFile ->
parser -> importer -> DB) round-trips a small workbook end to end.
"""

from __future__ import annotations

from io import BytesIO

import openpyxl
from app.main import app
from fastapi.testclient import TestClient


def _build_workbook() -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    ws = wb.create_sheet("Meine Ordner")
    ws.append(
        [
            "Ordner-Nr",
            "Ordnerbeschreibung",
            "Ordnerinhalt",
            "Prioritaet",
            "Kategorienpfad",
            "Ort",
            "Aktion",
        ]
    )
    ws.append([1001.0, "Folder 1001", None, None, None, "Office", None])
    ws.append([None, None, "Bank statement", "hoch", "Finanzen/Bank", None, "request statement"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_post_import_excel_returns_report():
    with TestClient(app) as client:
        files = {
            "file": (
                "topos.xlsx",
                _build_workbook(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        r = client.post("/api/import/excel", files=files)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["containers_created"] == 1
    assert body["items_created"] == 1
    assert body["actions_created"] == 1
    assert body["categories_created"] == 2
    assert "warnings" in body


def test_post_import_excel_rejects_empty_upload():
    with TestClient(app) as client:
        files = {"file": ("empty.xlsx", b"", "application/octet-stream")}
        r = client.post("/api/import/excel", files=files)
    assert r.status_code == 400

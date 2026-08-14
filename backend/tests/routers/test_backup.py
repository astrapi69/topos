"""Backup export + import router/service integration tests.

Import remaps every foreign key onto freshly assigned ids, so these tests
assert the RELATIONSHIPS survive, not the backup ids.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _envelope(mode_data: dict) -> dict:
    """Wrap entity arrays in a valid backup envelope."""
    return {"format": "topos-backup", "version": 1, "data": mode_data}


def _sample_data() -> dict:
    # Backup ids are arbitrary (100, 200, ...) so passing proves the importer
    # does not depend on them.
    return {
        "categories": [
            {
                "path": "finance",
                "parent_path": None,
                "name": "finance",
                "display_name": "Finanzen",
                "level": 0,
            }
        ],
        "containers": [
            {"id": 100, "external_id": 9001, "type": "box", "owner": "self", "label": "Box A"},
            {
                "id": 200,
                "external_id": 9002,
                "type": "folder",
                "owner": "self",
                "label": "Folder B",
            },
        ],
        "items": [
            {
                "id": 10,
                "container_id": 100,
                "content": "Invoice",
                "priority": "high",
                "category_path": "finance",
            },
            {"id": 20, "container_id": 200, "content": "Manual", "priority": "none"},
        ],
        "actions": [{"id": 1, "item_id": 10, "text": "review", "status": "open"}],
    }


def test_export_returns_all_four_entities(client: TestClient):
    client.post(
        "/api/containers",
        json={"external_id": 4242, "type": "box", "owner": "self", "label": "Snapshot me"},
    )
    resp = client.get("/api/backup/export")
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "topos-backup"
    assert body["version"] == 1
    assert body["source"] == "backend"
    assert "containers" in body["data"] and "items" in body["data"]
    assert body["stats"]["containers"] == len(body["data"]["containers"]) >= 1


def test_import_merge_remaps_foreign_keys(client: TestClient):
    resp = client.post("/api/backup/import?mode=merge", json=_envelope(_sample_data()))
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "merge"
    assert body["imported"] == {"containers": 2, "items": 2, "categories": 1, "actions": 1}
    assert body["errors"] == []

    containers = {c["external_id"]: c for c in client.get("/api/containers").json()}
    invoice = next(i for i in client.get("/api/items").json() if i["content"] == "Invoice")
    assert invoice["container_id"] == containers[9001]["id"]
    actions = client.get("/api/actions").json()
    assert actions[0]["item_id"] == invoice["id"]


def test_import_replace_wipes_existing_first(client: TestClient):
    client.post(
        "/api/containers",
        json={"external_id": 1, "type": "folder", "owner": "self", "label": "Old"},
    )
    resp = client.post("/api/backup/import?mode=replace", json=_envelope(_sample_data()))
    assert resp.status_code == 200
    externals = {c["external_id"] for c in client.get("/api/containers").json()}
    assert externals == {9001, 9002}


def test_merge_upserts_container_by_external_id(client: TestClient):
    client.post(
        "/api/containers",
        json={"external_id": 9001, "type": "box", "owner": "self", "label": "Original"},
    )
    client.post("/api/backup/import?mode=merge", json=_envelope(_sample_data()))
    matching = [c for c in client.get("/api/containers").json() if c["external_id"] == 9001]
    assert len(matching) == 1  # upserted, not duplicated
    assert matching[0]["label"] == "Box A"


def test_item_with_unknown_container_is_reported_not_fatal(client: TestClient):
    data = _sample_data()
    data["items"].append({"id": 99, "container_id": 999, "content": "Orphan", "priority": "none"})
    resp = client.post("/api/backup/import?mode=replace", json=_envelope(data))
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported"]["items"] == 2
    assert any("unknown container 999" in e for e in body["errors"])


def test_bad_format_is_rejected(client: TestClient):
    resp = client.post(
        "/api/backup/import?mode=merge",
        json={"format": "not-topos", "version": 1, "data": {}},
    )
    assert resp.status_code == 400


def test_unsupported_version_is_rejected(client: TestClient):
    resp = client.post(
        "/api/backup/import?mode=merge",
        json={"format": "topos-backup", "version": 2, "data": {}},
    )
    assert resp.status_code == 400


def test_backup_roundtrip_preserves_nesting(client) -> None:
    """parent_container_id survives export -> import. Parent references
    are backup-ids and must be remapped to the target database's ids."""
    shelf = client.post(
        "/api/containers",
        json={"external_id": 4300, "label": "Regal", "type": "shelf", "owner": "self"},
    ).json()
    client.post(
        "/api/containers",
        json={
            "external_id": 4301,
            "label": "Ordner im Regal",
            "type": "folder",
            "owner": "self",
            "parent_container_id": shelf["id"],
        },
    )

    exported = client.get("/api/backup/export").json()

    # replace wipes first, so the import itself is the reset.
    r = client.post("/api/backup/import?mode=replace", json=exported)
    assert r.status_code == 200, r.text

    rows = client.get("/api/containers").json()
    by_nr = {row["external_id"]: row for row in rows}
    assert by_nr[4301]["parent_container_id"] == by_nr[4300]["id"]
    assert by_nr[4300]["parent_container_id"] is None

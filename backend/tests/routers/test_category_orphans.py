"""Orphan-report tests: items whose ``category_path`` points at a
path that no longer exists in the ``Category`` table."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def container(client: TestClient) -> int:
    r = client.post(
        "/api/containers",
        json={"external_id": 7101, "type": "box", "owner": "self", "label": "Orphan box"},
    )
    assert r.status_code == 201
    return r.json()["id"]


def _create_item(client: TestClient, container_id: int, content: str, path: str | None) -> int:
    r = client.post(
        "/api/items",
        json={
            "container_id": container_id,
            "content": content,
            "priority": "none",
            "category_path": path,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_orphans_lists_only_dangling_paths(client: TestClient, container: int) -> None:
    client.post(
        "/api/categories",
        json={
            "path": "finance",
            "parent_path": None,
            "name": "finance",
            "display_name": "Finanzen",
            "level": 0,
        },
    )
    valid = _create_item(client, container, "valid ref", "finance")
    ghost = _create_item(client, container, "dangling ref", "ghost/deleted-path")
    _create_item(client, container, "no category", None)

    r = client.get("/api/categories/orphans")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 1
    ids = [row["id"] for row in body["orphaned_items"]]
    assert ids == [ghost]
    assert valid not in ids
    entry = body["orphaned_items"][0]
    assert entry["content"] == "dangling ref"
    assert entry["category_path"] == "ghost/deleted-path"
    assert entry["container_id"] == container


def test_orphans_empty_when_all_paths_resolve(client: TestClient, container: int) -> None:
    client.post(
        "/api/categories",
        json={
            "path": "household",
            "parent_path": None,
            "name": "household",
            "display_name": "Haushalt",
            "level": 0,
        },
    )
    _create_item(client, container, "fine", "household")

    r = client.get("/api/categories/orphans")
    assert r.status_code == 200
    assert r.json() == {"orphaned_items": [], "count": 0}


def test_orphans_appear_after_category_delete(client: TestClient, container: int) -> None:
    """Delete cascade nulls item paths, so a cascade delete must NOT
    produce orphans - only paths dangling for other reasons (imports,
    manual edits) land in the report."""
    r = client.post(
        "/api/categories",
        json={
            "path": "archive",
            "parent_path": None,
            "name": "archive",
            "display_name": "Archiv",
            "level": 0,
        },
    )
    cat_id = r.json()["id"]
    nulled = _create_item(client, container, "cascade nulls me", "archive")

    r = client.delete(f"/api/categories/{cat_id}")
    assert r.status_code == 200

    r = client.get("/api/categories/orphans")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    r = client.get(f"/api/items/{nulled}")
    assert r.json()["category_path"] is None

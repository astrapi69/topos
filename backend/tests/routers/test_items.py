"""Item router integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def container(client: TestClient) -> dict:
    r = client.post(
        "/api/containers",
        json={
            "external_id": 5001,
            "type": "folder",
            "owner": "self",
            "label": "Test container",
        },
    )
    assert r.status_code == 201
    return r.json()


def test_full_crud_round_trip(client: TestClient, container: dict) -> None:
    cid = container["id"]
    # Create
    r = client.post(
        "/api/items",
        json={
            "container_id": cid,
            "content": "First item",
            "priority": "high",
            "category_path": "finance/bank",
            "notes": "important",
        },
    )
    assert r.status_code == 201, r.text
    item = r.json()
    iid = item["id"]
    assert item["priority"] == "high"
    assert item["category_path"] == "finance/bank"

    # Read
    r = client.get(f"/api/items/{iid}")
    assert r.status_code == 200

    # List filter by container_id
    r = client.get("/api/items", params={"container_id": cid})
    assert r.status_code == 200
    assert [it["id"] for it in r.json()] == [iid]

    # Update
    r = client.patch(f"/api/items/{iid}", json={"priority": "low"})
    assert r.status_code == 200
    assert r.json()["priority"] == "low"

    # Delete
    r = client.delete(f"/api/items/{iid}")
    assert r.status_code == 204

    # Re-read 404
    r = client.get(f"/api/items/{iid}")
    assert r.status_code == 404


def test_get_missing_item_returns_404(client: TestClient) -> None:
    r = client.get("/api/items/999999")
    assert r.status_code == 404


def test_create_with_invalid_payload_returns_422(client: TestClient) -> None:
    r = client.post("/api/items", json={"container_id": "x"})
    assert r.status_code == 422


def test_create_with_missing_container_returns_404(client: TestClient) -> None:
    r = client.post(
        "/api/items",
        json={"container_id": 999999, "content": "orphan"},
    )
    assert r.status_code == 404


def test_search_items(client: TestClient, container: dict) -> None:
    cid = container["id"]
    client.post(
        "/api/items",
        json={"container_id": cid, "content": "checking account statement"},
    )
    client.post(
        "/api/items",
        json={"container_id": cid, "content": "tax forms"},
    )
    r = client.get("/api/items/search", params={"q": "account"})
    assert r.status_code == 200
    contents = [it["content"] for it in r.json()]
    assert any("checking account" in c for c in contents)
    assert all("tax forms" not in c for c in contents)

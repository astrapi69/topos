"""Container router integration tests.

Covers the happy-path CRUD round-trip plus the documented error
cases (404 on missing ids, 422 on invalid payloads, 409 on
external_id collision, 200 on by-external-id lookup).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _container_payload(external_id: int = 1001, **overrides) -> dict:
    payload = {
        "external_id": external_id,
        "type": "folder",
        "owner": "self",
        "label": f"Folder {external_id}",
        "description": None,
        "location": None,
        "size_group": None,
    }
    payload.update(overrides)
    return payload


def test_full_crud_round_trip(client: TestClient) -> None:
    # Create
    r = client.post("/api/containers", json=_container_payload(2001))
    assert r.status_code == 201, r.text
    body = r.json()
    cid = body["id"]
    assert body["external_id"] == 2001
    assert body["type"] == "folder"
    assert body["owner"] == "self"

    # Read
    r = client.get(f"/api/containers/{cid}")
    assert r.status_code == 200
    assert r.json()["external_id"] == 2001

    # List
    r = client.get("/api/containers")
    assert r.status_code == 200
    assert any(c["id"] == cid for c in r.json())

    # Filter by owner
    r = client.get("/api/containers", params={"owner": "self"})
    assert r.status_code == 200
    assert all(c["owner"] == "self" for c in r.json())

    # Update
    r = client.patch(f"/api/containers/{cid}", json={"label": "Renamed Folder"})
    assert r.status_code == 200
    assert r.json()["label"] == "Renamed Folder"

    # Delete
    r = client.delete(f"/api/containers/{cid}")
    assert r.status_code == 204

    # Read after delete
    r = client.get(f"/api/containers/{cid}")
    assert r.status_code == 404


def test_get_missing_container_returns_404(client: TestClient) -> None:
    r = client.get("/api/containers/999999")
    assert r.status_code == 404


def test_create_with_invalid_payload_returns_422(client: TestClient) -> None:
    r = client.post("/api/containers", json={"external_id": "not-an-int"})
    assert r.status_code == 422


def test_duplicate_external_id_returns_409(client: TestClient) -> None:
    client.post("/api/containers", json=_container_payload(3000))
    r = client.post("/api/containers", json=_container_payload(3000))
    assert r.status_code == 409


def test_get_by_external_id(client: TestClient) -> None:
    client.post("/api/containers", json=_container_payload(4000, label="Box 4000"))
    r = client.get("/api/containers/by-external-id/4000")
    assert r.status_code == 200
    assert r.json()["label"] == "Box 4000"

    r = client.get("/api/containers/by-external-id/99999")
    assert r.status_code == 404

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


def test_extended_container_types_roundtrip(client: TestClient) -> None:
    """The curated enum beyond folder/box: drawer, shelf, case, safe.

    The Settings toggle that offers these is a UI visibility filter
    only - the API accepts every enum value unconditionally, so imports
    and existing rows never depend on a per-device preference.
    """
    for offset, new_type in enumerate(["drawer", "shelf", "case", "safe"]):
        payload = {
            "external_id": 4100 + offset,
            "label": f"Typ-Test {new_type}",
            "type": new_type,
            "owner": "self",
        }
        r = client.post("/api/containers", json=payload)
        assert r.status_code == 201, (new_type, r.text)
        assert r.json()["type"] == new_type

        r = client.get(f"/api/containers/{r.json()['id']}")
        assert r.json()["type"] == new_type


def test_unknown_container_type_still_rejected(client: TestClient) -> None:
    r = client.post(
        "/api/containers",
        json={"external_id": 4199, "label": "x", "type": "spaceship", "owner": "self"},
    )
    assert r.status_code == 422


def test_container_nesting_roundtrip(client: TestClient) -> None:
    """A container can live inside another (folder in a shelf, box in a
    cabinet). parent_container_id is optional and nullable - top-level
    stays the default."""
    shelf = client.post(
        "/api/containers",
        json={"external_id": 4200, "label": "Regal", "type": "shelf", "owner": "self"},
    ).json()
    folder = client.post(
        "/api/containers",
        json={
            "external_id": 4201,
            "label": "Ordner im Regal",
            "type": "folder",
            "owner": "self",
            "parent_container_id": shelf["id"],
        },
    ).json()
    assert folder["parent_container_id"] == shelf["id"]

    # Detach: back to top level.
    r = client.patch(
        f"/api/containers/{folder['id']}", json={"parent_container_id": None}
    )
    assert r.status_code == 200
    assert r.json()["parent_container_id"] is None


def test_container_nesting_rejects_cycles(client: TestClient) -> None:
    """A -> B -> A must fail, as must A -> A. The service walks the
    parent chain of the target before writing."""
    a = client.post(
        "/api/containers",
        json={"external_id": 4210, "label": "A", "type": "box", "owner": "self"},
    ).json()
    b = client.post(
        "/api/containers",
        json={
            "external_id": 4211,
            "label": "B",
            "type": "box",
            "owner": "self",
            "parent_container_id": a["id"],
        },
    ).json()

    r = client.patch(
        f"/api/containers/{a['id']}", json={"parent_container_id": b["id"]}
    )
    assert r.status_code == 400
    r = client.patch(
        f"/api/containers/{a['id']}", json={"parent_container_id": a["id"]}
    )
    assert r.status_code == 400


def test_container_nesting_rejects_missing_parent(client: TestClient) -> None:
    r = client.post(
        "/api/containers",
        json={
            "external_id": 4220,
            "label": "Waise",
            "type": "box",
            "owner": "self",
            "parent_container_id": 999999,
        },
    )
    assert r.status_code == 404


def test_deleting_a_parent_detaches_children(client: TestClient) -> None:
    """Deleting a shelf must not delete the folders standing in it -
    they lose the parent and return to the top level. Contents of the
    container itself (items) keep cascading as before."""
    shelf = client.post(
        "/api/containers",
        json={"external_id": 4230, "label": "Regal", "type": "shelf", "owner": "self"},
    ).json()
    folder = client.post(
        "/api/containers",
        json={
            "external_id": 4231,
            "label": "Ordner",
            "type": "folder",
            "owner": "self",
            "parent_container_id": shelf["id"],
        },
    ).json()

    assert client.delete(f"/api/containers/{shelf['id']}").status_code == 204

    r = client.get(f"/api/containers/{folder['id']}")
    assert r.status_code == 200
    assert r.json()["parent_container_id"] is None

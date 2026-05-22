"""Action router integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def item(client: TestClient) -> dict:
    c = client.post(
        "/api/containers",
        json={
            "external_id": 7001,
            "type": "folder",
            "owner": "self",
            "label": "Container 7001",
        },
    )
    assert c.status_code == 201
    cid = c.json()["id"]
    r = client.post(
        "/api/items",
        json={"container_id": cid, "content": "Some content"},
    )
    assert r.status_code == 201
    return r.json()


def test_full_crud_round_trip(client: TestClient, item: dict) -> None:
    iid = item["id"]
    r = client.post("/api/actions", json={"item_id": iid, "text": "review and possibly cancel"})
    assert r.status_code == 201, r.text
    action = r.json()
    aid = action["id"]
    assert action["status"] == "open"
    assert action["completed_at"] is None

    r = client.get(f"/api/actions/{aid}")
    assert r.status_code == 200

    r = client.patch(f"/api/actions/{aid}", json={"text": "renamed"})
    assert r.status_code == 200
    assert r.json()["text"] == "renamed"

    r = client.delete(f"/api/actions/{aid}")
    assert r.status_code == 204
    assert client.get(f"/api/actions/{aid}").status_code == 404


def test_get_missing_action_returns_404(client: TestClient) -> None:
    assert client.get("/api/actions/999999").status_code == 404


def test_create_with_invalid_payload_returns_422(client: TestClient) -> None:
    r = client.post("/api/actions", json={"item_id": "x"})
    assert r.status_code == 422


def test_create_with_missing_item_returns_404(client: TestClient) -> None:
    r = client.post("/api/actions", json={"item_id": 999999, "text": "orphan"})
    assert r.status_code == 404


def test_list_filtered_by_status(client: TestClient, item: dict) -> None:
    iid = item["id"]
    client.post("/api/actions", json={"item_id": iid, "text": "a", "status": "open"})
    client.post("/api/actions", json={"item_id": iid, "text": "b", "status": "done"})
    r = client.get("/api/actions", params={"status": "open"})
    assert r.status_code == 200
    statuses = [a["status"] for a in r.json()]
    assert statuses == ["open"]


def test_complete_and_reopen(client: TestClient, item: dict) -> None:
    iid = item["id"]
    r = client.post("/api/actions", json={"item_id": iid, "text": "do it"})
    aid = r.json()["id"]

    r = client.post(f"/api/actions/{aid}/complete")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "done"
    assert body["completed_at"] is not None

    r = client.post(f"/api/actions/{aid}/reopen")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "open"
    assert body["completed_at"] is None

"""Category router integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _seed_tree(client: TestClient) -> None:
    """Seed a 3-level tree: finance -> bank -> checking-account."""
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
    client.post(
        "/api/categories",
        json={
            "path": "finance/bank",
            "parent_path": "finance",
            "name": "bank",
            "display_name": "Bank",
            "level": 1,
        },
    )
    client.post(
        "/api/categories",
        json={
            "path": "finance/bank/checking-account",
            "parent_path": "finance/bank",
            "name": "checking-account",
            "display_name": "Girokonto",
            "level": 2,
        },
    )


def test_full_crud_round_trip(client: TestClient) -> None:
    # Create
    r = client.post(
        "/api/categories",
        json={
            "path": "supplies",
            "parent_path": None,
            "name": "supplies",
            "display_name": "Hilfsmittel",
            "level": 0,
        },
    )
    assert r.status_code == 201
    cat = r.json()
    cid = cat["id"]

    # Read
    r = client.get(f"/api/categories/{cid}")
    assert r.status_code == 200

    # Update display_name
    r = client.patch(f"/api/categories/{cid}", json={"display_name": "Tools"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Tools"

    # Delete
    r = client.delete(f"/api/categories/{cid}")
    assert r.status_code == 204
    assert client.get(f"/api/categories/{cid}").status_code == 404


def test_get_missing_category_returns_404(client: TestClient) -> None:
    assert client.get("/api/categories/999999").status_code == 404


def test_create_with_invalid_payload_returns_422(client: TestClient) -> None:
    r = client.post("/api/categories", json={"path": None})
    assert r.status_code == 422


def test_duplicate_path_returns_409(client: TestClient) -> None:
    client.post(
        "/api/categories",
        json={"path": "dup", "name": "dup", "display_name": "Dup"},
    )
    r = client.post(
        "/api/categories",
        json={"path": "dup", "name": "dup", "display_name": "Dup-2"},
    )
    assert r.status_code == 409


def test_tree_nests_children(client: TestClient) -> None:
    _seed_tree(client)
    r = client.get("/api/categories/tree")
    assert r.status_code == 200
    tree = r.json()
    finance = next(node for node in tree if node["path"] == "finance")
    assert len(finance["children"]) == 1
    bank = finance["children"][0]
    assert bank["path"] == "finance/bank"
    assert len(bank["children"]) == 1
    assert bank["children"][0]["path"] == "finance/bank/checking-account"


def test_children_endpoint_filters_by_parent_path(client: TestClient) -> None:
    _seed_tree(client)
    r = client.get("/api/categories/children", params={"parent_path": "finance/bank"})
    assert r.status_code == 200
    children = r.json()
    assert [c["path"] for c in children] == ["finance/bank/checking-account"]

    # No parent_path means top-level
    r = client.get("/api/categories/children")
    assert r.status_code == 200
    paths = [c["path"] for c in r.json()]
    assert "finance" in paths
    assert "finance/bank" not in paths

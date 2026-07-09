"""Integration tests for ``POST /api/items/bulk``.

Pins the partial-success contract and the category policy: chains are
only created for rows carrying an explicitly confirmed
``new_category_path``, never from raw AI output.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def container(client: TestClient) -> dict:
    response = client.post(
        "/api/containers",
        json={
            "external_id": 8001,
            "type": "box",
            "owner": "self",
            "label": "Bulk test box",
        },
    )
    assert response.status_code == 201
    return response.json()


def _row(container_id: int, content: str, **extra: object) -> dict:
    return {"container_id": container_id, "content": content, **extra}


def test_happy_path_creates_all_rows(client, container) -> None:
    cid = container["id"]
    response = client.post(
        "/api/items/bulk",
        json={
            "items": [
                _row(cid, "Bohrmaschine", priority="high"),
                _row(cid, "Verlaengerungskabel", notes="5m"),
                _row(cid, "Steuerbescheid 2023", category_path="finance/tax"),
            ]
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["errors"] == []
    assert [item["content"] for item in body["created"]] == [
        "Bohrmaschine",
        "Verlaengerungskabel",
        "Steuerbescheid 2023",
    ]
    assert body["created"][0]["priority"] == "high"
    assert body["created"][2]["category_path"] == "finance/tax"
    listed = client.get("/api/items", params={"container_id": cid}).json()
    assert len(listed) == 3


def test_partial_success_reports_row_errors(client, container) -> None:
    cid = container["id"]
    response = client.post(
        "/api/items/bulk",
        json={
            "items": [
                _row(cid, "Valid item"),
                _row(99999, "Orphan row"),
                _row(cid, "   "),
                _row(cid, "Second valid item"),
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert [item["content"] for item in body["created"]] == ["Valid item", "Second valid item"]
    reasons = {error["index"]: error["reason"] for error in body["errors"]}
    assert set(reasons) == {1, 2}
    assert "not found" in reasons[1]
    assert "blank" in reasons[2]
    # The valid rows really persisted despite the failing siblings.
    listed = client.get("/api/items", params={"container_id": cid}).json()
    assert len(listed) == 2


def test_empty_items_list_is_422(client) -> None:
    response = client.post("/api/items/bulk", json={"items": []})
    assert response.status_code == 422


def test_confirmed_new_category_creates_chain(client, container) -> None:
    cid = container["id"]
    response = client.post(
        "/api/items/bulk",
        json={"items": [_row(cid, "Ordner Steuer", new_category_path="finance/tax/2023")]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["errors"] == []
    assert body["created"][0]["category_path"] == "finance/tax/2023"
    categories = {row["path"]: row for row in client.get("/api/categories").json()}
    assert {"finance", "finance/tax", "finance/tax/2023"} <= set(categories)
    assert categories["finance/tax"]["parent_path"] == "finance"
    assert categories["finance/tax/2023"]["level"] == 2


def test_confirmed_new_category_wins_over_category_path(client, container) -> None:
    response = client.post(
        "/api/items/bulk",
        json={
            "items": [
                _row(
                    container["id"],
                    "Werkzeugkiste",
                    category_path="misc",
                    new_category_path="tools",
                )
            ]
        },
    )
    assert response.json()["created"][0]["category_path"] == "tools"


def test_invalid_new_category_path_is_row_error(client, container) -> None:
    cid = container["id"]
    response = client.post(
        "/api/items/bulk",
        json={
            "items": [
                _row(cid, "Bad category row", new_category_path="Finanzen/Steuer 2023"),
                _row(cid, "Good row"),
            ]
        },
    )
    body = response.json()
    assert len(body["created"]) == 1
    assert body["errors"][0]["index"] == 0
    assert "Invalid category path" in body["errors"][0]["reason"]
    # No category rows were created from the rejected path.
    assert client.get("/api/categories").json() == []


def test_existing_category_is_reused_not_duplicated(client, container) -> None:
    created = client.post(
        "/api/categories",
        json={"path": "tools", "name": "tools", "display_name": "Werkzeug"},
    )
    assert created.status_code == 201
    response = client.post(
        "/api/items/bulk",
        json={"items": [_row(container["id"], "Hammer", new_category_path="tools")]},
    )
    assert response.json()["errors"] == []
    paths = [row["path"] for row in client.get("/api/categories").json()]
    assert paths.count("tools") == 1


def test_plain_category_path_never_creates_categories(client, container) -> None:
    response = client.post(
        "/api/items/bulk",
        json={"items": [_row(container["id"], "Akku", category_path="electronics/batteries")]},
    )
    assert response.json()["created"][0]["category_path"] == "electronics/batteries"
    # Loose reference semantics: no Category rows spring into existence.
    assert client.get("/api/categories").json() == []

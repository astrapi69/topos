"""Rename- and delete-cascade tests for categories.

The category path is a loose string reference on ``Item.category_path``
(audit: issue #11). Renaming or deleting a category must keep those
references consistent: rename rewrites every item path carrying the old
prefix, delete nulls them out instead of leaving orphans.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _create_category(client: TestClient, path: str, parent: str | None, level: int) -> int:
    name = path.rsplit("/", 1)[-1]
    r = client.post(
        "/api/categories",
        json={
            "path": path,
            "parent_path": parent,
            "name": name,
            "display_name": name.title(),
            "level": level,
        },
    )
    assert r.status_code == 201, r.text
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


@pytest.fixture
def container(client: TestClient) -> int:
    r = client.post(
        "/api/containers",
        json={"external_id": 7001, "type": "folder", "owner": "self", "label": "Cascade box"},
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture
def tree(client: TestClient) -> dict[str, int]:
    """finance -> bank -> checking-account, plus unrelated household."""
    ids = {}
    ids["finance"] = _create_category(client, "finance", None, 0)
    ids["finance/bank"] = _create_category(client, "finance/bank", "finance", 1)
    ids["finance/bank/checking-account"] = _create_category(
        client, "finance/bank/checking-account", "finance/bank", 2
    )
    ids["household"] = _create_category(client, "household", None, 0)
    return ids


def _item_path(client: TestClient, item_id: int) -> str | None:
    r = client.get(f"/api/items/{item_id}")
    assert r.status_code == 200
    return r.json()["category_path"]


class TestRenameCascade:
    def test_rename_updates_items_and_subcategories(
        self, client: TestClient, container: int, tree: dict[str, int]
    ) -> None:
        exact = _create_item(client, container, "tax file", "finance")
        child = _create_item(client, container, "bank statement", "finance/bank")
        deep = _create_item(client, container, "checking", "finance/bank/checking-account")
        other = _create_item(client, container, "vacuum", "household")

        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "money"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["renamed"] is True
        assert body["items_updated"] == 3
        assert body["subcategories_updated"] == 2
        assert body["category"]["path"] == "money"
        assert body["category"]["name"] == "money"
        assert body["category"]["level"] == 0

        assert _item_path(client, exact) == "money"
        assert _item_path(client, child) == "money/bank"
        assert _item_path(client, deep) == "money/bank/checking-account"
        assert _item_path(client, other) == "household"

        # Subcategory rows follow: path, parent_path and level stay consistent.
        rows = {c["path"]: c for c in client.get("/api/categories").json()}
        assert "finance" not in rows and "finance/bank" not in rows
        assert rows["money/bank"]["parent_path"] == "money"
        assert rows["money/bank"]["level"] == 1
        assert rows["money/bank/checking-account"]["parent_path"] == "money/bank"
        assert rows["money/bank/checking-account"]["level"] == 2

    def test_rename_root_prefix_does_not_touch_lookalike_paths(
        self, client: TestClient, container: int, tree: dict[str, int]
    ) -> None:
        """'finance' -> 'finances': 'finance-extra' and 'finances/x' items
        share the string start but not the path prefix - they must survive."""
        renamed = _create_item(client, container, "in scope", "finance/bank")
        lookalike = _create_item(client, container, "dash sibling", "finance-extra")
        already = _create_item(client, container, "target sibling", "finances/x")

        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "finances"})
        assert r.status_code == 200, r.text
        assert _item_path(client, renamed) == "finances/bank"
        assert _item_path(client, lookalike) == "finance-extra"
        assert _item_path(client, already) == "finances/x"

    def test_rename_does_not_double_replace_repeated_segment(
        self, client: TestClient, container: int, tree: dict[str, int]
    ) -> None:
        """Regression pin for the naive REPLACE() approach: an item path
        repeating the renamed segment ('finance/finance') must only have
        its PREFIX rewritten."""
        repeated = _create_item(client, container, "nested twin", "finance/finance")

        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "money"})
        assert r.status_code == 200
        assert _item_path(client, repeated) == "money/finance"

    def test_rename_to_existing_path_conflicts(
        self, client: TestClient, tree: dict[str, int]
    ) -> None:
        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "household"})
        assert r.status_code == 409

    def test_rename_to_invalid_path_is_rejected(
        self, client: TestClient, tree: dict[str, int]
    ) -> None:
        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "Bad Path!"})
        assert r.status_code == 400

    def test_rename_into_own_subtree_is_rejected(
        self, client: TestClient, tree: dict[str, int]
    ) -> None:
        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "finance/sub"})
        assert r.status_code == 400

    def test_move_under_new_parent_creates_missing_ancestors(
        self, client: TestClient, container: int, tree: dict[str, int]
    ) -> None:
        moved = _create_item(client, container, "moved", "finance/bank")

        r = client.patch(f"/api/categories/{tree['finance']}", json={"path": "archive/finance"})
        assert r.status_code == 200, r.text
        assert _item_path(client, moved) == "archive/finance/bank"

        rows = {c["path"]: c for c in client.get("/api/categories").json()}
        assert "archive" in rows  # ancestor auto-created
        assert rows["archive/finance"]["parent_path"] == "archive"
        assert rows["archive/finance"]["level"] == 1
        assert rows["archive/finance/bank"]["level"] == 2

    def test_patch_without_path_still_updates_display_name(
        self, client: TestClient, tree: dict[str, int]
    ) -> None:
        r = client.patch(f"/api/categories/{tree['finance']}", json={"display_name": "Geld"})
        assert r.status_code == 200
        assert r.json()["display_name"] == "Geld"


class TestDeleteCascade:
    def test_delete_orphans_items_and_removes_subcategories(
        self, client: TestClient, container: int, tree: dict[str, int]
    ) -> None:
        exact = _create_item(client, container, "tax file", "finance")
        deep = _create_item(client, container, "checking", "finance/bank/checking-account")
        other = _create_item(client, container, "vacuum", "household")

        r = client.delete(f"/api/categories/{tree['finance']}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] is True
        assert body["items_orphaned"] == 2
        assert body["subcategories_deleted"] == 2

        assert _item_path(client, exact) is None
        assert _item_path(client, deep) is None
        assert _item_path(client, other) == "household"

        rows = {c["path"] for c in client.get("/api/categories").json()}
        assert rows == {"household"}

    def test_delete_leaf_without_items(self, client: TestClient, tree: dict[str, int]) -> None:
        r = client.delete(f"/api/categories/{tree['finance/bank/checking-account']}")
        assert r.status_code == 200
        body = r.json()
        assert body == {"deleted": True, "items_orphaned": 0, "subcategories_deleted": 0}

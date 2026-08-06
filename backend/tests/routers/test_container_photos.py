"""Container photo attachment router/service tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

FULL = b"\xff\xd8\xff\xe0FULLJPEGBYTES"
THUMB = b"\xff\xd8\xff\xe0THUMBJPEGBYTES"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def container_id(client: TestClient) -> int:
    resp = client.post(
        "/api/containers",
        json={"external_id": 7001, "type": "box", "owner": "self", "label": "Photo box"},
    )
    return resp.json()["id"]


def _upload(
    client: TestClient, cid: int, full: bytes = FULL, thumb: bytes = THUMB, mime: str = "image/jpeg"
):
    return client.post(
        f"/api/containers/{cid}/photos",
        files={
            "full": ("full.jpg", full, mime),
            "thumb": ("thumb.jpg", thumb, mime),
        },
    )


def test_upload_list_and_serve(client: TestClient, container_id: int):
    resp = _upload(client, container_id)
    assert resp.status_code == 201
    photo = resp.json()
    assert photo["container_id"] == container_id
    assert photo["full_url"].endswith(f"/photos/{photo['id']}/full")

    listed = client.get(f"/api/containers/{container_id}/photos").json()
    assert len(listed) == 1

    full = client.get(f"/api/containers/{container_id}/photos/{photo['id']}/full")
    assert full.status_code == 200
    assert full.content == FULL
    thumb = client.get(f"/api/containers/{container_id}/photos/{photo['id']}/thumb")
    assert thumb.content == THUMB


def test_delete_removes_photo(client: TestClient, container_id: int):
    photo_id = _upload(client, container_id).json()["id"]
    assert client.delete(f"/api/containers/{container_id}/photos/{photo_id}").status_code == 204
    assert client.get(f"/api/containers/{container_id}/photos").json() == []
    assert client.get(f"/api/containers/{container_id}/photos/{photo_id}/full").status_code == 404


def test_deleting_container_cascades_photos(client: TestClient, container_id: int):
    photo_id = _upload(client, container_id).json()["id"]
    assert client.delete(f"/api/containers/{container_id}").status_code in (200, 204)
    # The photo serve now 404s (container + rows gone).
    assert client.get(f"/api/containers/{container_id}/photos/{photo_id}/full").status_code == 404


def test_upload_to_unknown_container_404(client: TestClient):
    resp = _upload(client, 999999)
    assert resp.status_code == 404


def test_reject_unsupported_mime(client: TestClient, container_id: int):
    resp = _upload(client, container_id, mime="application/pdf")
    assert resp.status_code == 400

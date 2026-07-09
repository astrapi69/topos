"""Integration tests for ``POST /api/ai/vision``.

Provider clients are mocked at the service boundary
(``app.ai.vision.recognize_*``); the merged app config is injected by
monkeypatching ``app.main._load_app_config``. No network, no real keys.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai import vision as vision_service
from app.ai.vision_schemas import RecognizedItem
from app.exceptions import ExternalServiceError, RateLimitError
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def container(client: TestClient) -> dict:
    response = client.post(
        "/api/containers",
        json={
            "external_id": 7001,
            "type": "folder",
            "owner": "self",
            "label": "Vision test folder",
        },
    )
    assert response.status_code == 201
    return response.json()


def _ai_config(**overrides: Any) -> dict[str, Any]:
    ai_block: dict[str, Any] = {
        "enabled": True,
        "active_provider": "anthropic",
        "models": {"anthropic": "claude-sonnet-4-6", "custom": "llava"},
        "base_urls": {"custom": "http://localhost:11434/v1"},
        "keys": {"anthropic": "sk-ant", "custom": "sk-local"},
    }
    ai_block.update(overrides)
    return {"ai": ai_block}


@pytest.fixture
def use_config(monkeypatch: pytest.MonkeyPatch):
    """Return a setter that pins the merged app config for the request."""
    from app import main as main_module

    def _apply(config: dict[str, Any]) -> None:
        monkeypatch.setattr(main_module, "_load_app_config", lambda: config)

    return _apply


def _recognized() -> list[RecognizedItem]:
    return [
        RecognizedItem(
            label="Steuerbescheid 2023",
            category_path="finance/tax",
            description="Einkommensteuerbescheid",
            confidence=0.9,
        )
    ]


def _post_photo(client: TestClient, container_id: int, **form_overrides: str):
    form_data = {"container_id": str(container_id), **form_overrides}
    return client.post(
        "/api/ai/vision",
        files={"file": ("photo.jpg", b"jpeg-bytes", "image/jpeg")},
        data=form_data,
    )


def test_happy_path_returns_items(client, container, use_config, monkeypatch) -> None:
    use_config(_ai_config())
    captured: dict[str, Any] = {}

    def fake_anthropic(**kwargs: Any) -> list[RecognizedItem]:
        captured.update(kwargs)
        return _recognized()

    monkeypatch.setattr(vision_service, "recognize_anthropic", fake_anthropic)
    response = _post_photo(client, container["id"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "anthropic"
    assert body["model"] == "claude-sonnet-4-6"
    assert body["items"][0]["label"] == "Steuerbescheid 2023"
    assert body["items"][0]["new_category_hint"] == ""
    assert captured["api_key"] == "sk-ant"
    assert captured["media_type"] == "image/jpeg"


def test_prompt_carries_container_type_and_categories(
    client, container, use_config, monkeypatch
) -> None:
    created = client.post(
        "/api/categories",
        json={"path": "tools", "name": "tools", "display_name": "Werkzeug"},
    )
    assert created.status_code == 201, created.text
    use_config(_ai_config())
    captured: dict[str, Any] = {}

    def fake_anthropic(**kwargs: Any) -> list[RecognizedItem]:
        captured.update(kwargs)
        return []

    monkeypatch.setattr(vision_service, "recognize_anthropic", fake_anthropic)
    response = _post_photo(client, container["id"])
    assert response.status_code == 200
    # No explicit container_type in the form: falls back to the stored
    # container's type (folder -> documents focus hint).
    assert "folder" in captured["prompt"]
    assert "documents" in captured["prompt"]
    assert "tools" in captured["prompt"]


def test_explicit_container_type_wins(client, container, use_config, monkeypatch) -> None:
    use_config(_ai_config())
    captured: dict[str, Any] = {}

    def fake_anthropic(**kwargs: Any) -> list[RecognizedItem]:
        captured.update(kwargs)
        return []

    monkeypatch.setattr(vision_service, "recognize_anthropic", fake_anthropic)
    response = _post_photo(client, container["id"], container_type="box")
    assert response.status_code == 200
    assert "box" in captured["prompt"]
    assert "physical objects" in captured["prompt"]


def test_custom_provider_dispatches_openai_compatible(
    client, container, use_config, monkeypatch
) -> None:
    use_config(_ai_config(active_provider="custom"))
    captured: dict[str, Any] = {}

    def fake_openai(**kwargs: Any) -> list[RecognizedItem]:
        captured.update(kwargs)
        return _recognized()

    monkeypatch.setattr(vision_service, "recognize_openai", fake_openai)
    response = _post_photo(client, container["id"])
    assert response.status_code == 200
    assert response.json()["provider"] == "custom"
    assert response.json()["model"] == "llava"
    assert captured["provider"] == "custom"
    assert captured["base_url"] == "http://localhost:11434/v1"


def test_ai_disabled_returns_400(client, container, use_config) -> None:
    use_config(_ai_config(enabled=False))
    response = _post_photo(client, container["id"])
    assert response.status_code == 400
    assert "disabled" in response.json()["detail"]


def test_missing_api_key_returns_400(client, container, use_config) -> None:
    use_config(_ai_config(keys={"anthropic": ""}))
    response = _post_photo(client, container["id"])
    assert response.status_code == 400
    assert "API key" in response.json()["detail"]


def test_custom_without_base_url_returns_400(client, container, use_config) -> None:
    use_config(_ai_config(active_provider="custom", base_urls={"custom": ""}))
    response = _post_photo(client, container["id"])
    assert response.status_code == 400
    assert "base URL" in response.json()["detail"]


def test_unknown_container_returns_404(client, use_config) -> None:
    use_config(_ai_config())
    response = _post_photo(client, 99999)
    assert response.status_code == 404


def test_unsupported_media_type_returns_400(client, container, use_config) -> None:
    use_config(_ai_config())
    response = client.post(
        "/api/ai/vision",
        files={"file": ("scan.pdf", b"%PDF-", "application/pdf")},
        data={"container_id": str(container["id"])},
    )
    assert response.status_code == 400
    assert "Unsupported image type" in response.json()["detail"]


def test_empty_file_returns_400(client, container, use_config) -> None:
    use_config(_ai_config())
    response = client.post(
        "/api/ai/vision",
        files={"file": ("photo.jpg", b"", "image/jpeg")},
        data={"container_id": str(container["id"])},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_rate_limit_maps_to_429(client, container, use_config, monkeypatch) -> None:
    use_config(_ai_config())

    def raise_rate_limit(**kwargs: Any) -> list[RecognizedItem]:
        raise RateLimitError("anthropic: rate limit exceeded, retry later")

    monkeypatch.setattr(vision_service, "recognize_anthropic", raise_rate_limit)
    response = _post_photo(client, container["id"])
    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"]


def test_provider_failure_maps_to_502(client, container, use_config, monkeypatch) -> None:
    use_config(_ai_config())

    def raise_external(**kwargs: Any) -> list[RecognizedItem]:
        raise ExternalServiceError("anthropic", "HTTP 500: overloaded")

    monkeypatch.setattr(vision_service, "recognize_anthropic", raise_external)
    response = _post_photo(client, container["id"])
    assert response.status_code == 502
    assert "anthropic" in response.json()["detail"]

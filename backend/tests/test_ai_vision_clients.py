"""Unit tests for the per-provider vision clients.

The single network call (``_post``) is monkeypatched so these run
offline and deterministically, mirroring ``test_ai_connection.py``.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.ai import vision_clients
from app.exceptions import ExternalServiceError, RateLimitError

_ITEM = {
    "label": "Bohrmaschine",
    "category_path": "tools",
    "new_category_hint": "",
    "description": "Gruene Akku-Bohrmaschine",
    "confidence": 0.85,
}

_KWARGS = {
    "api_key": "sk-test",
    "model": "test-model",
    "image_b64": "aGVsbG8=",
    "media_type": "image/jpeg",
    "prompt": "list the items",
}


def _patch_post(
    monkeypatch: pytest.MonkeyPatch, responses: list[tuple[int, dict[str, Any]]]
) -> list[dict[str, Any]]:
    """Replace ``_post`` with a scripted stub; returns the captured calls."""
    calls: list[dict[str, Any]] = []

    def fake_post(url, *, headers, params, payload, timeout):
        calls.append({"url": url, "headers": headers, "params": params, "payload": payload})
        return responses[min(len(calls), len(responses)) - 1]

    monkeypatch.setattr(vision_clients, "_post", fake_post)
    return calls


def _anthropic_ok() -> dict[str, Any]:
    return {"content": [{"type": "tool_use", "name": "report_items", "input": {"items": [_ITEM]}}]}


def _openai_ok() -> dict[str, Any]:
    import json

    return {"choices": [{"message": {"content": json.dumps({"items": [_ITEM]})}}]}


def _google_ok() -> dict[str, Any]:
    import json

    return {"candidates": [{"content": {"parts": [{"text": json.dumps({"items": [_ITEM]})}]}}]}


# --- request building ---


def test_anthropic_request_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_post(monkeypatch, [(200, _anthropic_ok())])
    parsed = vision_clients.recognize_anthropic(base_url="https://api.anthropic.com/v1", **_KWARGS)
    assert parsed[0].label == "Bohrmaschine"
    sent = calls[0]
    assert sent["url"] == "https://api.anthropic.com/v1/messages"
    assert sent["headers"]["x-api-key"] == "sk-test"
    assert "anthropic-version" in sent["headers"]
    assert sent["payload"]["tool_choice"] == {"type": "tool", "name": "report_items"}
    image_block = sent["payload"]["messages"][0]["content"][0]
    assert image_block["type"] == "image"
    assert image_block["source"]["media_type"] == "image/jpeg"
    assert image_block["source"]["data"] == "aGVsbG8="


def test_openai_request_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_post(monkeypatch, [(200, _openai_ok())])
    parsed = vision_clients.recognize_openai(base_url="https://api.openai.com/v1", **_KWARGS)
    assert parsed[0].label == "Bohrmaschine"
    sent = calls[0]
    assert sent["url"] == "https://api.openai.com/v1/chat/completions"
    assert sent["headers"]["Authorization"] == "Bearer sk-test"
    response_format = sent["payload"]["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    image_part = sent["payload"]["messages"][0]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_google_request_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_post(monkeypatch, [(200, _google_ok())])
    parsed = vision_clients.recognize_google(
        base_url="https://generativelanguage.googleapis.com/v1beta", **_KWARGS
    )
    assert parsed[0].label == "Bohrmaschine"
    sent = calls[0]
    assert sent["url"].endswith("/models/test-model:generateContent")
    assert sent["params"] == {"key": "sk-test"}
    inline_part = sent["payload"]["contents"][0]["parts"][0]
    assert inline_part["inlineData"]["mimeType"] == "image/jpeg"
    generation_config = sent["payload"]["generationConfig"]
    assert generation_config["responseMimeType"] == "application/json"
    assert generation_config["responseSchema"]["type"] == "OBJECT"
    assert "additionalProperties" not in generation_config["responseSchema"]


# --- response handling ---


def test_anthropic_falls_back_to_text_block(monkeypatch: pytest.MonkeyPatch) -> None:
    fenced = '```json\n{"items": [{"label": "Akku", "confidence": 0.6}]}\n```'
    _patch_post(monkeypatch, [(200, {"content": [{"type": "text", "text": fenced}]})])
    parsed = vision_clients.recognize_anthropic(base_url="https://x/v1", **_KWARGS)
    assert parsed[0].label == "Akku"


def test_openai_downgrades_response_format_on_400(monkeypatch: pytest.MonkeyPatch) -> None:
    rejected = (400, {"error": {"message": "response_format not supported"}})
    calls = _patch_post(monkeypatch, [rejected, (200, _openai_ok())])
    parsed = vision_clients.recognize_openai(
        base_url="http://localhost:11434/v1", provider="custom", **_KWARGS
    )
    assert parsed[0].label == "Bohrmaschine"
    assert len(calls) == 2
    assert "response_format" in calls[0]["payload"]
    assert "response_format" not in calls[1]["payload"]


def test_openai_second_400_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    rejected = (400, {"error": {"message": "bad request"}})
    _patch_post(monkeypatch, [rejected, rejected])
    with pytest.raises(ExternalServiceError, match="HTTP 400"):
        vision_clients.recognize_openai(base_url="http://localhost:11434/v1", **_KWARGS)


# --- error mapping ---


def test_auth_error_maps_to_external_service_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_post(monkeypatch, [(401, {"error": {"message": "invalid x-api-key"}})])
    with pytest.raises(ExternalServiceError, match="authentication failed") as excinfo:
        vision_clients.recognize_anthropic(base_url="https://x/v1", **_KWARGS)
    assert excinfo.value.status_code == 502


def test_rate_limit_maps_to_429(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_post(monkeypatch, [(429, {"error": {"message": "quota exceeded"}})])
    with pytest.raises(RateLimitError, match="rate limit") as excinfo:
        vision_clients.recognize_google(base_url="https://x/v1beta", **_KWARGS)
    assert excinfo.value.status_code == 429
    assert "quota exceeded" in excinfo.value.detail


def test_timeout_maps_to_external_service_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(url, *, headers, params, payload, timeout):
        raise httpx.ReadTimeout("too slow")

    monkeypatch.setattr(vision_clients, "_post", boom)
    with pytest.raises(ExternalServiceError, match="timed out"):
        vision_clients.recognize_openai(base_url="https://x/v1", **_KWARGS)


def test_network_error_maps_to_external_service_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(url, *, headers, params, payload, timeout):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(vision_clients, "_post", boom)
    with pytest.raises(ExternalServiceError, match="network error"):
        vision_clients.recognize_anthropic(base_url="https://x/v1", **_KWARGS)


def test_server_error_maps_to_external_service_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_post(monkeypatch, [(500, {"error": {"message": "overloaded"}})])
    with pytest.raises(ExternalServiceError, match="HTTP 500: overloaded"):
        vision_clients.recognize_openai(base_url="https://x/v1", **_KWARGS)


def test_unparseable_response_maps_to_external_service_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_post(
        monkeypatch,
        [(200, {"choices": [{"message": {"content": "I see a box with stuff."}}]})],
    )
    with pytest.raises(ExternalServiceError, match="unparseable"):
        vision_clients.recognize_openai(base_url="https://x/v1", **_KWARGS)

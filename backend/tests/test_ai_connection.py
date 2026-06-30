"""Unit tests for the provider connectivity probe.

The single network call (``_get``) is monkeypatched so these run
offline and deterministically.
"""

from __future__ import annotations

import httpx
import pytest

from app.ai import connection


def _patch_status(monkeypatch: pytest.MonkeyPatch, status: int) -> dict:
    """Replace ``_get`` with a stub returning ``status`` and capturing args."""
    captured: dict = {}

    def fake_get(url, *, headers, params, timeout):
        captured.update(url=url, headers=headers, params=params, timeout=timeout)
        return status

    monkeypatch.setattr(connection, "_get", fake_get)
    return captured


def test_build_request_anthropic_uses_x_api_key() -> None:
    url, headers, params = connection._build_request(
        "anthropic", "sk-ant", "https://api.anthropic.com/v1"
    )
    assert url == "https://api.anthropic.com/v1/models"
    assert headers["x-api-key"] == "sk-ant"
    assert "anthropic-version" in headers
    assert params is None


def test_build_request_google_uses_query_param() -> None:
    url, headers, params = connection._build_request(
        "google", "AIza", "https://generativelanguage.googleapis.com/v1beta"
    )
    assert params == {"key": "AIza"}
    assert headers == {}


def test_build_request_openai_uses_bearer() -> None:
    _, headers, _ = connection._build_request("openai", "sk-oa", "https://api.openai.com/v1")
    assert headers["Authorization"] == "Bearer sk-oa"


def test_build_request_strips_trailing_slash() -> None:
    url, _, _ = connection._build_request("openai", "k", "https://x/v1/")
    assert url == "https://x/v1/models"


def test_test_connection_ok_on_200(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _patch_status(monkeypatch, 200)
    result = connection.test_connection("anthropic", api_key="sk-ant", base_url="")
    assert result == {"ok": True, "error_code": None}
    # Falls back to the preset base URL when none is supplied.
    assert captured["url"].startswith("https://api.anthropic.com/v1")


def test_test_connection_auth_error_on_401(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_status(monkeypatch, 401)
    result = connection.test_connection("openai", api_key="bad", base_url="")
    assert result == {"ok": False, "error_code": "auth_error"}


def test_test_connection_provider_error_on_500(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_status(monkeypatch, 500)
    result = connection.test_connection("openai", api_key="k", base_url="")
    assert result["error_code"] == "provider_error"


def test_test_connection_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(url, *, headers, params, timeout):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(connection, "_get", boom)
    result = connection.test_connection("openai", api_key="k", base_url="")
    assert result["error_code"] == "network_error"


def test_test_connection_missing_key() -> None:
    result = connection.test_connection("anthropic", api_key="", base_url="")
    assert result == {"ok": False, "error_code": "missing_key"}


def test_test_connection_custom_missing_base_url() -> None:
    result = connection.test_connection("custom", api_key="k", base_url="")
    assert result == {"ok": False, "error_code": "missing_base_url"}


def test_test_connection_custom_with_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _patch_status(monkeypatch, 200)
    result = connection.test_connection("custom", api_key="k", base_url="http://localhost:11434/v1")
    assert result["ok"] is True
    assert captured["url"] == "http://localhost:11434/v1/models"


def test_test_connection_unknown_provider() -> None:
    result = connection.test_connection("mistral", api_key="k", base_url="")
    assert result == {"ok": False, "error_code": "unknown_provider"}

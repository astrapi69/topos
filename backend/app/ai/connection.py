"""Lightweight provider connectivity / API-key probe.

Validates a provider + API key by hitting the provider's models
listing endpoint - a cheap, side-effect-free GET that returns 200 on a
valid key and 401/403 on a bad one. This is NOT an LLM client: it pulls
in no provider SDK and sends no prompt, it only answers "does this key
authenticate?" for the Settings "Test connection" button.

The single network call goes through ``_get`` so tests can monkeypatch
it without real HTTP.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.ai.providers import get_provider

_ANTHROPIC_VERSION = "2023-06-01"
_DEFAULT_TIMEOUT = 10.0


def _get(
    url: str, *, headers: dict[str, str], params: dict[str, str] | None, timeout: float
) -> int:
    """Perform the probe GET and return the HTTP status code.

    Isolated so tests monkeypatch this one function instead of the
    whole httpx surface. Raises ``httpx.HTTPError`` subclasses on
    transport failure (caller maps them to ``network_error``).
    """
    with httpx.Client(timeout=timeout) as client:
        response = client.get(url, headers=headers, params=params)
    return response.status_code


def _build_request(
    provider_id: str, api_key: str, base_url: str
) -> tuple[str, dict[str, str], dict[str, str] | None]:
    """Return ``(url, headers, params)`` for the provider's models probe."""
    base = base_url.rstrip("/")
    url = f"{base}/models"
    if provider_id == "anthropic":
        return url, {"x-api-key": api_key, "anthropic-version": _ANTHROPIC_VERSION}, None
    if provider_id == "google":
        # Gemini authenticates via a query param, not a header.
        return url, {}, {"key": api_key}
    # openai + custom (OpenAI-compatible): bearer token.
    return url, {"Authorization": f"Bearer {api_key}"}, None


def test_connection(
    provider_id: str,
    *,
    api_key: str,
    base_url: str,
    timeout: float = _DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Probe a provider with the given key.

    Returns ``{ok: bool, error_code: str | None}`` where ``error_code``
    is one of ``unknown_provider`` / ``missing_base_url`` / ``missing_key``
    / ``auth_error`` / ``provider_error`` / ``network_error`` (``None``
    on success). No key value is logged or returned.
    """
    preset = get_provider(provider_id)
    if preset is None:
        return {"ok": False, "error_code": "unknown_provider"}

    effective_base = (base_url or preset.base_url).strip()
    if preset.requires_base_url and not effective_base:
        return {"ok": False, "error_code": "missing_base_url"}
    if preset.requires_api_key and not (api_key or "").strip():
        return {"ok": False, "error_code": "missing_key"}

    url, headers, params = _build_request(provider_id, api_key, effective_base)
    try:
        status = _get(url, headers=headers, params=params, timeout=timeout)
    except httpx.HTTPError:
        return {"ok": False, "error_code": "network_error"}

    if status == 200:
        return {"ok": True, "error_code": None}
    if status in (401, 403):
        return {"ok": False, "error_code": "auth_error"}
    return {"ok": False, "error_code": "provider_error"}

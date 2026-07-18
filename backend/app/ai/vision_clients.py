"""HTTP clients for vision recognition, one function per provider.

No provider SDK: every request is a single JSON POST built with httpx
(the reusability hierarchy stops at an existing dependency). Structured
output is enforced provider-natively:

* Anthropic: forced tool use (``tool_choice`` on a ``report_items``
  tool whose ``input_schema`` is ``ITEMS_JSON_SCHEMA``).
* OpenAI + custom (OpenAI-compatible): ``response_format`` of type
  ``json_schema``. Local servers (Ollama, LM Studio) may reject that
  with HTTP 400, so the request is retried once without
  ``response_format`` and the tolerant parser takes over.
* Google: ``responseSchema`` + ``responseMimeType`` in
  ``generationConfig``.

Provider errors map to typed domain errors: 401/403 -> clear
key-problem detail, 429 -> ``RateLimitError`` (HTTP 429),
timeout/transport and other statuses -> ``ExternalServiceError``
(HTTP 502). The single network call goes through ``_post`` so tests
monkeypatch exactly one seam.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.ai.vision_parsing import parse_items_payload
from app.ai.vision_schemas import (
    ITEMS_JSON_SCHEMA,
    RecognizedItem,
    google_response_schema,
)
from app.exceptions import ExternalServiceError, RateLimitError

logger = logging.getLogger(__name__)

_ANTHROPIC_VERSION = "2023-06-01"
_TOOL_NAME = "report_items"
DEFAULT_TIMEOUT = 60.0
MAX_OUTPUT_TOKENS = 2048


def _post(
    url: str,
    *,
    headers: dict[str, str],
    params: dict[str, str] | None,
    payload: dict[str, Any],
    timeout: float,
) -> tuple[int, dict[str, Any]]:
    """Perform the provider POST and return ``(status, parsed body)``.

    Isolated so tests monkeypatch this one function instead of the
    whole httpx surface. Raises ``httpx.HTTPError`` subclasses on
    transport failure (mapped by ``_send``).
    """
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, params=params, json=payload)
    try:
        body = response.json()
    except ValueError:
        body = {}
    return response.status_code, body


def _send(
    provider: str,
    url: str,
    *,
    headers: dict[str, str],
    params: dict[str, str] | None,
    payload: dict[str, Any],
    timeout: float,
) -> tuple[int, dict[str, Any]]:
    """POST with transport errors mapped; HTTP status handling stays
    with the caller (OpenAI needs the raw 400 for its retry)."""
    try:
        return _post(url, headers=headers, params=params, payload=payload, timeout=timeout)
    except httpx.TimeoutException as exc:
        logger.error("Vision request to %s timed out: %s", provider, exc)
        raise ExternalServiceError(provider, f"request timed out after {timeout:.0f}s") from exc
    except httpx.HTTPError as exc:
        logger.error("Vision request to %s failed: %s", provider, exc)
        raise ExternalServiceError(provider, f"network error: {exc}") from exc


def _error_detail(body: dict[str, Any]) -> str:
    """Pull the most useful error message out of a provider error body."""
    error_block = body.get("error")
    if isinstance(error_block, dict):
        message = error_block.get("message")
        if isinstance(message, str) and message:
            return message
    message = body.get("message")
    if isinstance(message, str) and message:
        return message
    return str(body)[:300] if body else "no error detail in response"


def _raise_for_status(provider: str, status: int, body: dict[str, Any]) -> None:
    """Map provider HTTP errors to typed domain errors."""
    if status < 400:
        return
    detail = _error_detail(body)
    if status in (401, 403):
        raise ExternalServiceError(
            provider,
            f"authentication failed (HTTP {status}) - check the API key in Settings",
        )
    if status == 429:
        raise RateLimitError(f"{provider}: rate limit exceeded, retry later ({detail})")
    raise ExternalServiceError(provider, f"HTTP {status}: {detail}")


def _parse(provider: str, output_payload: Any) -> list[RecognizedItem]:
    """Run the tolerant parser, wrapping failures as provider errors."""
    try:
        return parse_items_payload(output_payload)
    except ValueError as exc:
        logger.error("Unparseable vision response from %s: %s", provider, exc)
        raise ExternalServiceError(provider, f"unparseable model response: {exc}") from exc


# --- Anthropic ---


def recognize_anthropic(
    *,
    api_key: str,
    base_url: str,
    model: str,
    image_b64: str,
    media_type: str,
    prompt: str,
    timeout: float = DEFAULT_TIMEOUT,
) -> list[RecognizedItem]:
    """Recognize items via the Anthropic Messages API (forced tool use)."""
    url = f"{base_url.rstrip('/')}/messages"
    headers = {"x-api-key": api_key, "anthropic-version": _ANTHROPIC_VERSION}
    request_payload = {
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "tools": [
            {
                "name": _TOOL_NAME,
                "description": "Report every clearly visible item on the photo.",
                "input_schema": ITEMS_JSON_SCHEMA,
            }
        ],
        "tool_choice": {"type": "tool", "name": _TOOL_NAME},
    }
    status, body = _send(
        "anthropic", url, headers=headers, params=None, payload=request_payload, timeout=timeout
    )
    _raise_for_status("anthropic", status, body)
    return _parse("anthropic", _anthropic_output(body))


def _anthropic_output(body: dict[str, Any]) -> Any:
    """Extract the tool-use input (preferred) or the text fallback."""
    content_blocks = body.get("content") or []
    for block in content_blocks:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            return block.get("input", {})
    text_parts = [
        block.get("text", "")
        for block in content_blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "\n".join(text_parts)


# --- OpenAI + custom (OpenAI-compatible) ---


def recognize_openai(
    *,
    api_key: str,
    base_url: str,
    model: str,
    image_b64: str,
    media_type: str,
    prompt: str,
    timeout: float = DEFAULT_TIMEOUT,
    provider: str = "openai",
) -> list[RecognizedItem]:
    """Recognize items via an OpenAI-compatible chat-completions API.

    Also serves the ``custom`` provider (local Ollama / LM Studio):
    pass ``provider="custom"`` so error messages name the right party.
    """
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    structured_payload = _openai_payload(model, image_b64, media_type, prompt, structured=True)
    status, body = _send(
        provider, url, headers=headers, params=None, payload=structured_payload, timeout=timeout
    )
    if status == 400:
        # Local OpenAI-compatible servers may not know json_schema;
        # retry once without response_format, the parser tolerates prose.
        logger.warning(
            "%s rejected json_schema response_format (HTTP 400: %s); retrying without it",
            provider,
            _error_detail(body),
        )
        plain_payload = _openai_payload(model, image_b64, media_type, prompt, structured=False)
        status, body = _send(
            provider, url, headers=headers, params=None, payload=plain_payload, timeout=timeout
        )
    _raise_for_status(provider, status, body)
    return _parse(provider, _openai_output(body))


def _openai_payload(
    model: str, image_b64: str, media_type: str, prompt: str, *, structured: bool
) -> dict[str, Any]:
    request_payload: dict[str, Any] = {
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }
    if structured:
        request_payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": _TOOL_NAME, "strict": True, "schema": ITEMS_JSON_SCHEMA},
        }
    return request_payload


def _openai_output(body: dict[str, Any]) -> Any:
    choices = body.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return ""
    message = choices[0].get("message") or {}
    return message.get("content") or ""


# --- Google (Gemini) ---


def recognize_google(
    *,
    api_key: str,
    base_url: str,
    model: str,
    image_b64: str,
    media_type: str,
    prompt: str,
    timeout: float = DEFAULT_TIMEOUT,
) -> list[RecognizedItem]:
    """Recognize items via the Gemini generateContent API."""
    url = f"{base_url.rstrip('/')}/models/{model}:generateContent"
    request_payload = {
        "contents": [
            {
                "parts": [
                    {"inlineData": {"mimeType": media_type, "data": image_b64}},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": google_response_schema(),
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
        },
    }
    status, body = _send(
        "google",
        url,
        headers={},
        params={"key": api_key},
        payload=request_payload,
        timeout=timeout,
    )
    _raise_for_status("google", status, body)
    return _parse("google", _google_output(body))


def _google_output(body: dict[str, Any]) -> Any:
    candidates = body.get("candidates") or []
    if not candidates or not isinstance(candidates[0], dict):
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "\n".join(
        part.get("text", "") for part in parts if isinstance(part, dict) and part.get("text")
    )

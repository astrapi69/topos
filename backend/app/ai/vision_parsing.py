"""Tolerant parsing of vision-model output into ``RecognizedItem`` rows.

Primary path: the provider's structured output is already a dict
(Anthropic forced tool use) or a clean JSON string (OpenAI
``json_schema``, Gemini ``responseSchema``). Fallback path: custom
OpenAI-compatible local servers may ignore the schema and return
prose-wrapped or fenced JSON; this module strips markdown fences and
extracts the first valid JSON fragment before validating.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from pydantic import ValidationError as PydanticValidationError

from app.ai.vision_schemas import RecognizedItem

logger = logging.getLogger(__name__)

_FENCE_OPEN_RE = re.compile(r"^```[a-zA-Z0-9_-]*\s*\n?")
_FENCE_CLOSE_RE = re.compile(r"\n?```\s*$")


def parse_items_payload(payload: Any) -> list[RecognizedItem]:
    """Turn a model response into validated ``RecognizedItem`` rows.

    Accepts a dict (``{"items": [...]}``), a bare list, or a string
    carrying JSON (optionally fenced or embedded in prose). Malformed
    individual entries are skipped with a warning so one bad row does
    not discard an otherwise usable recognition.

    Args:
        payload: The raw model output in any of the accepted shapes.

    Returns:
        The validated items (possibly empty for an empty container).

    Raises:
        ValueError: When the payload carries no item list at all.
    """
    decoded = _decode_json_text(payload) if isinstance(payload, str) else payload
    if isinstance(decoded, dict):
        decoded = decoded.get("items")
    if not isinstance(decoded, list):
        raise ValueError("model response carries no item list")
    recognized: list[RecognizedItem] = []
    for entry in decoded:
        if not isinstance(entry, dict):
            logger.warning("Skipping non-object item entry: %r", entry)
            continue
        try:
            recognized.append(RecognizedItem.model_validate(entry))
        except PydanticValidationError as exc:
            logger.warning("Skipping malformed item entry %r: %s", entry, exc)
    return recognized


def _decode_json_text(text: str) -> Any:
    """Decode JSON from ``text``, tolerating fences and surrounding prose.

    Raises:
        ValueError: When no JSON fragment can be extracted.
    """
    stripped = _strip_fences(text.strip())
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        fragment = _extract_json_fragment(stripped)
        if fragment is None:
            raise ValueError("model response contains no JSON") from None
        return json.loads(fragment)


def _strip_fences(text: str) -> str:
    """Remove a single wrapping markdown code fence, if present."""
    if not text.startswith("```"):
        return text
    without_open = _FENCE_OPEN_RE.sub("", text, count=1)
    return _FENCE_CLOSE_RE.sub("", without_open, count=1)


def _extract_json_fragment(text: str) -> str | None:
    """Return the first parseable JSON object/array embedded in ``text``."""
    decoder = json.JSONDecoder()
    for start, char in enumerate(text):
        if char not in "[{":
            continue
        try:
            _, end = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            continue
        return text[start : start + end]
    return None

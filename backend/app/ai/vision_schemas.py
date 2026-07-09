"""Schemas for the photo-intake vision pipeline.

``RecognizedItem`` / ``VisionResult`` are the wire format that
``POST /api/ai/vision`` returns. ``ITEMS_JSON_SCHEMA`` is the single
source of truth for the provider-native structured-output contract
(Anthropic tool ``input_schema``, OpenAI ``json_schema``); the Gemini
variant is derived from it because Gemini's Schema proto knows neither
``additionalProperties`` nor numeric bounds.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator


class RecognizedItem(BaseModel):
    """One item the vision model claims to see on the photo.

    Attributes:
        label: Short German name of the item (never blank).
        category_path: Best match from the EXISTING categories, or ``""``
            when none clearly fits. The model must not invent paths here.
        new_category_hint: Optional english-kebab-case proposal when no
            existing category fits. Only ever applied after the user
            explicitly confirms it in the staging list.
        description: Brief German description of what is visible.
        confidence: Visual certainty in [0, 1]. Uncalibrated - the UI
            shows it as a hint, nothing load-bearing.
    """

    label: str
    category_path: str = ""
    new_category_hint: str = ""
    description: str = ""
    confidence: float = 0.0

    @field_validator("confidence", mode="before")
    @classmethod
    def _clamp_confidence(cls, value: Any) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return 0.0
        return min(1.0, max(0.0, numeric))

    @field_validator("label")
    @classmethod
    def _label_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("label must not be blank")
        return stripped


class VisionResult(BaseModel):
    """Response payload of ``POST /api/ai/vision``."""

    provider: str
    model: str
    items: list[RecognizedItem]


_ITEM_PROPERTIES: dict[str, Any] = {
    "label": {"type": "string", "description": "Short German name of the item."},
    "category_path": {
        "type": "string",
        "description": "Best match from the existing categories, or empty string.",
    },
    "new_category_hint": {
        "type": "string",
        "description": "english-kebab-case proposal when no existing category fits, else empty.",
    },
    "description": {"type": "string", "description": "Brief German description of the item."},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
}

ITEMS_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": _ITEM_PROPERTIES,
                "required": sorted(_ITEM_PROPERTIES),
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def google_response_schema() -> dict[str, Any]:
    """Return the Gemini variant of ``ITEMS_JSON_SCHEMA``.

    Gemini's ``responseSchema`` follows the Schema proto: uppercase type
    names, no ``additionalProperties``, no numeric bounds. Derived from
    the canonical schema so the two can never drift apart.
    """
    return _to_google_schema(ITEMS_JSON_SCHEMA)


def _to_google_schema(node: dict[str, Any]) -> dict[str, Any]:
    converted: dict[str, Any] = {"type": node["type"].upper()}
    if "description" in node:
        converted["description"] = node["description"]
    if node["type"] == "object":
        converted["properties"] = {
            name: _to_google_schema(child) for name, child in node["properties"].items()
        }
        converted["required"] = list(node.get("required", []))
    elif node["type"] == "array":
        converted["items"] = _to_google_schema(node["items"])
    return converted

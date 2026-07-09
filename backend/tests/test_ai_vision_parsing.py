"""Unit tests for the tolerant vision-output parser."""

from __future__ import annotations

import pytest

from app.ai.vision_parsing import parse_items_payload

_VALID_ENTRY = {
    "label": "Steuerbescheid 2023",
    "category_path": "finance/tax",
    "new_category_hint": "",
    "description": "Einkommensteuerbescheid",
    "confidence": 0.9,
}


def test_parses_dict_payload_with_items_key() -> None:
    parsed = parse_items_payload({"items": [_VALID_ENTRY]})
    assert len(parsed) == 1
    assert parsed[0].label == "Steuerbescheid 2023"
    assert parsed[0].category_path == "finance/tax"


def test_parses_bare_list_payload() -> None:
    parsed = parse_items_payload([_VALID_ENTRY, _VALID_ENTRY])
    assert len(parsed) == 2


def test_parses_clean_json_string() -> None:
    parsed = parse_items_payload('{"items": [' + _entry_json() + "]}")
    assert len(parsed) == 1


def test_strips_markdown_fences() -> None:
    fenced = '```json\n{"items": [' + _entry_json() + "]}\n```"
    parsed = parse_items_payload(fenced)
    assert len(parsed) == 1


def test_extracts_json_embedded_in_prose() -> None:
    prose = "Here is what I found:\n[" + _entry_json() + "]\nLet me know if you need more."
    parsed = parse_items_payload(prose)
    assert len(parsed) == 1


def test_skips_malformed_entries_but_keeps_valid_ones() -> None:
    blank_label = dict(_VALID_ENTRY, label="   ")
    parsed = parse_items_payload({"items": [blank_label, "not-a-dict", _VALID_ENTRY]})
    assert len(parsed) == 1


def test_clamps_confidence_into_unit_interval() -> None:
    over = dict(_VALID_ENTRY, confidence=1.7)
    under = dict(_VALID_ENTRY, confidence=-0.2)
    stringy = dict(_VALID_ENTRY, confidence="0.4")
    parsed = parse_items_payload({"items": [over, under, stringy]})
    assert [entry.confidence for entry in parsed] == [1.0, 0.0, 0.4]


def test_defaults_optional_fields() -> None:
    parsed = parse_items_payload({"items": [{"label": "Schraubenzieher"}]})
    assert parsed[0].category_path == ""
    assert parsed[0].new_category_hint == ""
    assert parsed[0].description == ""
    assert parsed[0].confidence == 0.0


def test_empty_item_list_is_valid() -> None:
    assert parse_items_payload({"items": []}) == []


def test_raises_on_dict_without_items_key() -> None:
    with pytest.raises(ValueError, match="no item list"):
        parse_items_payload({"unexpected": True})


def test_raises_on_prose_without_json() -> None:
    with pytest.raises(ValueError, match="no JSON"):
        parse_items_payload("I cannot see any items on this photo.")


def _entry_json() -> str:
    import json

    return json.dumps(_VALID_ENTRY)

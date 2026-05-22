"""Tests for the German -> English mapping helpers.

Covers the priority map (every known value + an unmapped value
that should land in ``warnings``), the slugifier (known segment
hit, unknown segment fallback, umlaut transliteration, empty
input handling), and the display-name preservation that the
importer relies on for ``Category.display_name``.
"""

from __future__ import annotations

from topos_excel_import.mappings import (
    SlugifiedPath,
    priority_from_german,
    slugify_category_path,
)


def test_priority_map_all_known_values():
    cases = {
        "sehr hoch": "very_high",
        "hoch": "high",
        "mittel": "medium",
        "niedrig": "low",
        "keine": "none",
        "": "none",
    }
    for raw, expected in cases.items():
        value, warning = priority_from_german(raw)
        assert value == expected
        assert warning is None


def test_priority_map_is_case_insensitive():
    value, warning = priority_from_german("Sehr Hoch")
    assert value == "very_high"
    assert warning is None


def test_priority_unknown_value_defaults_to_none_with_warning():
    value, warning = priority_from_german("super hoch")
    assert value == "none"
    assert warning is not None
    assert "super hoch" in warning


def test_priority_none_input_returns_none():
    value, warning = priority_from_german(None)
    assert value == "none"
    assert warning is None


def test_slugify_known_segments_use_english_slug():
    result = slugify_category_path("Finanzen/Bank/Girokonto")
    assert isinstance(result, SlugifiedPath)
    assert result.path == "finance/bank/checking-account"
    assert result.segments == [
        ("finance", "Finanzen"),
        ("bank", "Bank"),
        ("checking-account", "Girokonto"),
    ]
    assert result.warnings == []


def test_slugify_unknown_segment_uses_mechanical_fallback_and_warns():
    result = slugify_category_path("Finanzen/Schlumpfhausen")
    assert result is not None
    assert result.path == "finance/schlumpfhausen"
    assert result.segments[1] == ("schlumpfhausen", "Schlumpfhausen")
    assert len(result.warnings) == 1
    assert "Schlumpfhausen" in result.warnings[0]


def test_slugify_umlauts_transliterated_in_fallback():
    result = slugify_category_path("Ärztehaus")
    assert result is not None
    assert result.path == "aerztehaus"
    assert result.segments == [("aerztehaus", "Ärztehaus")]


def test_slugify_empty_input_returns_none():
    assert slugify_category_path(None) is None
    assert slugify_category_path("") is None
    assert slugify_category_path("   ") is None


def test_slugify_drops_empty_intermediate_segments():
    result = slugify_category_path("Finanzen//Bank")
    assert result is not None
    assert result.path == "finance/bank"
    assert [s[0] for s in result.segments] == ["finance", "bank"]


def test_display_names_are_german_originals_even_when_slug_is_english():
    result = slugify_category_path("Finanzen/Bank/Girokonto")
    assert result is not None
    display_names = [display for _, display in result.segments]
    assert display_names == ["Finanzen", "Bank", "Girokonto"]

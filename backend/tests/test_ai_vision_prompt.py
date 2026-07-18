"""Unit tests for vision prompt assembly and category selection."""

from __future__ import annotations

from app.ai.vision_prompt import (
    MAX_PROMPT_CATEGORIES,
    build_vision_prompt,
    select_categories_for_prompt,
)


def test_prompt_contains_box_focus_hint() -> None:
    prompt = build_vision_prompt("box", ["finance/tax"])
    assert "physical objects" in prompt
    assert "finance/tax" in prompt


def test_prompt_contains_folder_focus_hint() -> None:
    prompt = build_vision_prompt("folder", [])
    assert "documents" in prompt


def test_prompt_unknown_type_gets_generic_hint() -> None:
    prompt = build_vision_prompt("shelf", [])
    assert "clearly identifiable items" in prompt


def test_prompt_without_categories_says_none_defined() -> None:
    prompt = build_vision_prompt("box", [])
    assert "(none defined yet)" in prompt


def test_prompt_carries_anti_hallucination_rules() -> None:
    prompt = build_vision_prompt("box", ["archive/2024"])
    assert "Never guess" in prompt
    assert "Do NOT invent categories" in prompt


def test_select_small_taxonomy_passes_through_sorted() -> None:
    picked = select_categories_for_prompt(["b/x", "a/y", "a/y", "  ", ""])
    assert picked == ["a/y", "b/x"]


def test_select_large_taxonomy_drops_deep_paths() -> None:
    deep = [f"root/mid/leaf-{i}" for i in range(MAX_PROMPT_CATEGORIES + 50)]
    shallow = ["finance", "finance/tax", "archive/2024"]
    picked = select_categories_for_prompt(deep + shallow)
    assert picked == sorted(shallow)


def test_select_hard_caps_shallow_overflow() -> None:
    shallow = [f"top-{i:04d}" for i in range(MAX_PROMPT_CATEGORIES + 20)]
    picked = select_categories_for_prompt(shallow)
    assert len(picked) == MAX_PROMPT_CATEGORIES
    assert picked == sorted(shallow)[:MAX_PROMPT_CATEGORIES]

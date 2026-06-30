"""Unit tests for reading the AI config block and resolving key source.

These exercise pure functions: the merged config and the secrets-file
path are passed in, so no real filesystem or env state is required
(except where a test explicitly sets an env var).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.ai import config as ai_config


def test_get_ai_config_returns_block() -> None:
    merged = {"ai": {"enabled": True, "active_provider": "openai"}}
    assert ai_config.get_ai_config(merged) == {
        "enabled": True,
        "active_provider": "openai",
    }


def test_get_ai_config_missing_block_returns_empty() -> None:
    assert ai_config.get_ai_config({}) == {}


def test_get_ai_config_malformed_block_returns_empty() -> None:
    assert ai_config.get_ai_config({"ai": "not-a-dict"}) == {}


def test_is_ai_enabled_default_false() -> None:
    assert ai_config.is_ai_enabled({}) is False
    assert ai_config.is_ai_enabled({"ai": {"enabled": False}}) is False


def test_is_ai_enabled_true() -> None:
    assert ai_config.is_ai_enabled({"ai": {"enabled": True}}) is True


def test_get_active_provider_default() -> None:
    assert ai_config.get_active_provider({}) == "anthropic"
    assert ai_config.get_active_provider({"ai": {}}) == "anthropic"


def test_get_active_provider_from_config() -> None:
    assert ai_config.get_active_provider({"ai": {"active_provider": "google"}}) == "google"


# --- key source resolution ---


def test_key_source_none_when_unconfigured(tmp_path: Path) -> None:
    status = ai_config.get_ai_key_status(
        "anthropic", secrets_yaml_path=tmp_path / "secrets.yaml", config={}
    )
    assert status == {
        "provider": "anthropic",
        "configured": False,
        "source": "none",
        "externally_managed": False,
    }


def test_key_source_env_wins(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TOPOS_ANTHROPIC_API_KEY", "sk-from-env")
    status = ai_config.get_ai_key_status(
        "anthropic",
        secrets_yaml_path=tmp_path / "secrets.yaml",
        config={"ai": {"keys": {"anthropic": "sk-overlay"}}},
    )
    assert status["source"] == "env"
    assert status["configured"] is True
    assert status["externally_managed"] is True


def test_key_source_secrets_yaml(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TOPOS_OPENAI_API_KEY", raising=False)
    secrets = tmp_path / "secrets.yaml"
    secrets.write_text("ai:\n  keys:\n    openai: sk-from-file\n", encoding="utf-8")
    status = ai_config.get_ai_key_status("openai", secrets_yaml_path=secrets, config={})
    assert status["source"] == "secrets_yaml"
    assert status["externally_managed"] is True


def test_key_source_app_yaml_overlay(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TOPOS_GEMINI_API_KEY", raising=False)
    status = ai_config.get_ai_key_status(
        "google",
        secrets_yaml_path=tmp_path / "secrets.yaml",
        config={"ai": {"keys": {"google": "sk-overlay"}}},
    )
    assert status["source"] == "app_yaml"
    assert status["configured"] is True
    assert status["externally_managed"] is False


def test_empty_overlay_key_is_unconfigured(tmp_path: Path) -> None:
    status = ai_config.get_ai_key_status(
        "google",
        secrets_yaml_path=tmp_path / "secrets.yaml",
        config={"ai": {"keys": {"google": "   "}}},
    )
    assert status["source"] == "none"
    assert status["configured"] is False


def test_unknown_provider_key_status(tmp_path: Path) -> None:
    status = ai_config.get_ai_key_status(
        "mistral", secrets_yaml_path=tmp_path / "secrets.yaml", config={}
    )
    assert status["configured"] is False
    assert status["source"] == "none"


def test_is_externally_managed_helper(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TOPOS_OPENAI_API_KEY", "sk-env")
    assert (
        ai_config.is_ai_key_externally_managed(
            "openai", secrets_yaml_path=tmp_path / "secrets.yaml", config={}
        )
        is True
    )
    monkeypatch.delenv("TOPOS_OPENAI_API_KEY", raising=False)
    assert (
        ai_config.is_ai_key_externally_managed(
            "openai",
            secrets_yaml_path=tmp_path / "secrets.yaml",
            config={"ai": {"keys": {"openai": "sk-overlay"}}},
        )
        is False
    )

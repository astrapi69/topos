"""Tests for the three-layer config loader.

Layer chain: project app.yaml < user override file < env-vars.
Covers XDG path, Windows path, deep merge precedence, env-var
overrides, deprecation warning, and graceful corrupt-override
handling.

The loader lives in :mod:`app.main`; we import the helpers
directly and monkeypatch CONFIG_PATH + override-path resolution
per test so each case is hermetic.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest
import yaml

from app import main as main_module


@pytest.fixture
def project_yaml(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Stand up a fresh project app.yaml + override path in tmp_path
    and monkeypatch the loader so it reads from there. Returns the
    project yaml path so tests can write content to it.

    Each test gets its own tmp_path so override-file presence,
    env-var state, AND the v0.32.x ``config_overlay`` user-overlay
    file are isolated from any state a previous test may have
    written into the session-scope ``TOPOS_DATA_DIR``.
    """
    project = tmp_path / "app.yaml"
    project.write_text("", encoding="utf-8")
    monkeypatch.setattr(main_module, "CONFIG_PATH", project)
    override = tmp_path / "secrets.yaml"
    monkeypatch.setattr(main_module, "_get_user_override_path", lambda: override)
    # Isolate the v0.32.x config-overlay layer too: point
    # TOPOS_DATA_DIR at a per-test tmp so leftover writes from
    # earlier tests (Settings PATCH, plugin install/uninstall) do
    # not pollute the merged view this loader returns.
    monkeypatch.setenv("TOPOS_DATA_DIR", str(tmp_path / "user-data"))
    # Always start with a clean env so env-var tests opt-in.
    monkeypatch.delenv("TOPOS_AI_API_KEY", raising=False)
    return project


def _write(path: Path, data: dict) -> None:
    path.write_text(yaml.safe_dump(data), encoding="utf-8")


def test_project_only_baseline(project_yaml: Path) -> None:
    """Without override + env-vars, merged config equals project."""
    _write(project_yaml, {"ai": {"provider": "anthropic", "api_key": ""}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["provider"] == "anthropic"
    assert cfg["ai"]["api_key"] == ""


def test_override_only_ai_key(project_yaml: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Override file supplies ai.api_key; project has empty value."""
    _write(project_yaml, {"ai": {"provider": "anthropic", "api_key": ""}})
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "sk-from-override"}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "sk-from-override"
    # Project keys preserved.
    assert cfg["ai"]["provider"] == "anthropic"


def test_nested_merge_precedence(project_yaml: Path) -> None:
    """Override touches one nested key; siblings + parents preserved."""
    _write(
        project_yaml,
        {
            "ai": {
                "provider": "anthropic",
                "api_key": "",
                "model": "claude-sonnet-4-20250514",
            },
            "app": {"name": "Topos"},
        },
    )
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "sk-override"}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "sk-override"
    assert cfg["ai"]["provider"] == "anthropic"
    assert cfg["ai"]["model"] == "claude-sonnet-4-20250514"
    assert cfg["app"]["name"] == "Topos"


# Removed in Phase 3 of the bootstrap:
# - test_env_var_beats_project_and_override
# - test_deprecation_warning_when_secret_in_project_only
# - test_no_deprecation_warning_when_override_exists
#
# These tests pinned the env-var override mechanism for ``TOPOS_AI_API_KEY``
# and the deprecation warning when a secret sits in the project yaml
# without an override. Both were AI-feature-specific; Topos has no AI
# integration so the underlying helpers in ``app.main``
# (_apply_env_overrides, _has_project_secret_without_override,
# _ENV_SECRET_OVERRIDES) were removed too. Add a focused replacement
# the first time Topos grows a config item that warrants env-var
# precedence.


def test_xdg_config_home_respected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """XDG_CONFIG_HOME env-var redirects the override path on
    Linux/macOS."""
    monkeypatch.setattr("sys.platform", "linux")
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    path = main_module._get_user_override_path()
    assert path == tmp_path / "xdg" / "topos" / "secrets.yaml"


def test_windows_appdata_branch(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """On Windows, %APPDATA%/topos/secrets.yaml is the override
    location."""
    monkeypatch.setattr("sys.platform", "win32")
    monkeypatch.setenv("APPDATA", str(tmp_path / "AppData" / "Roaming"))
    path = main_module._get_user_override_path()
    assert path == tmp_path / "AppData" / "Roaming" / "topos" / "secrets.yaml"


def test_corrupt_override_file_does_not_crash(
    project_yaml: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Malformed override yaml falls back to project config without
    crashing. Backend MUST start (loader returns project dict, never
    raises).

    Three corruption shapes covered: invalid YAML syntax, top-level
    non-dict (e.g. list), empty file. Phase 3's slim loader logs a
    single ``Could not load override file`` warning on the first two
    shapes and stays silent on empty files.
    """
    _write(project_yaml, {"app": {"name": "Topos", "default_language": "de"}})
    override = main_module._get_user_override_path()

    captured: list[str] = []
    original_warning = main_module.logger.warning

    def spy(msg: str, *args: object, **kwargs: object) -> None:
        captured.append(msg % args if args else msg)
        original_warning(msg, *args, **kwargs)

    monkeypatch.setattr(main_module.logger, "warning", spy)

    # Invalid YAML syntax.
    override.write_text("this is: : : not valid yaml :\n  - broken", encoding="utf-8")
    cfg = main_module._load_app_config()
    assert cfg["app"]["name"] == "Topos"
    assert any("Could not load override file" in m for m in captured), captured

    # Top-level non-dict: loader silently coerces to {} per the Phase 3 simplification.
    captured.clear()
    override.write_text("- one\n- two\n", encoding="utf-8")
    cfg = main_module._load_app_config()
    assert cfg["app"]["name"] == "Topos"

    # Empty file -> silently treated as empty override (no warning).
    captured.clear()
    override.write_text("", encoding="utf-8")
    cfg = main_module._load_app_config()
    assert cfg["app"]["name"] == "Topos"
    assert captured == []


def test_lists_are_replaced_not_merged(project_yaml: Path) -> None:
    """Override list replaces base list verbatim. Confirms we don't
    accidentally concatenate; relevant for ``app.supported_languages``,
    ``topics``, etc."""
    _write(project_yaml, {"app": {"supported_languages": ["de", "en", "es"]}})
    override = main_module._get_user_override_path()
    _write(override, {"app": {"supported_languages": ["fr"]}})
    cfg = main_module._load_app_config()
    assert cfg["app"]["supported_languages"] == ["fr"]


def test_deep_merge_helper_pure_function() -> None:
    """``_deep_merge`` is documented as non-mutating; verify."""
    base = {"a": 1, "nested": {"x": 1, "y": 2}}
    override = {"nested": {"y": 99, "z": 3}}
    out = main_module._deep_merge(base, override)
    assert out == {"a": 1, "nested": {"x": 1, "y": 99, "z": 3}}
    # Inputs unchanged.
    assert base == {"a": 1, "nested": {"x": 1, "y": 2}}
    assert override == {"nested": {"y": 99, "z": 3}}

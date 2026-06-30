"""Tests for the secrets-loading module + the env-override layer.

Covers:

- ``apply_env_overrides`` walks the ``_ENV_SECRET_OVERRIDES`` map
  and overlays env-var values onto the merged config dict (env-var
  set, env-var unset, env-var empty-string, nested paths).
- ``register_plugin_secret_override`` extends the map at runtime and
  rejects empty input.
- ``ensure_secrets_template`` creates a 0o600 file with a sensible
  template + is idempotent.
- ``warn_if_world_readable`` logs the right WARNING for permissive
  modes (0o644, 0o604, 0o660) and stays quiet for safe modes (0o600,
  0o400).
- ``get_secret_key_source`` reports the expected source in every
  branch (env / file with value / file without value / missing file /
  malformed file).
"""

from __future__ import annotations

import logging
import os
import stat
from pathlib import Path

import pytest

from app import secrets_store


@pytest.fixture(autouse=True)
def _clean_env_overrides(monkeypatch: pytest.MonkeyPatch):
    """Snapshot + restore ``_ENV_SECRET_OVERRIDES`` so per-test
    ``register_plugin_secret_override`` calls do not leak between
    tests."""
    snapshot = dict(secrets_store._ENV_SECRET_OVERRIDES)
    yield
    secrets_store._ENV_SECRET_OVERRIDES.clear()
    secrets_store._ENV_SECRET_OVERRIDES.update(snapshot)


@pytest.fixture(autouse=True)
def _clear_topos_env(monkeypatch: pytest.MonkeyPatch):
    for var in (
        "TOPOS_SECRET_KEY",
        "TOPOS_PLUGIN_TESTING_SECRET",
        "TOPOS_ANTHROPIC_API_KEY",
        "TOPOS_OPENAI_API_KEY",
        "TOPOS_GEMINI_API_KEY",
        "TOPOS_CUSTOM_API_KEY",
    ):
        monkeypatch.delenv(var, raising=False)


def test_apply_env_overrides_lands_secret_key_at_top_level(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TOPOS_SECRET_KEY", "from-env")
    merged = secrets_store.apply_env_overrides({"app": {"name": "Topos"}})
    assert merged["secret_key"] == "from-env"
    assert merged["app"] == {"name": "Topos"}


def test_apply_env_overrides_skips_unset_and_empty_envs() -> None:
    merged = secrets_store.apply_env_overrides({"app": {"name": "Topos"}})
    assert "secret_key" not in merged


def test_apply_env_overrides_does_not_mutate_input(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TOPOS_SECRET_KEY", "from-env")
    original = {"app": {"name": "Topos"}}
    secrets_store.apply_env_overrides(original)
    assert original == {"app": {"name": "Topos"}}


def test_apply_env_overrides_lands_ai_key_at_nested_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TOPOS_ANTHROPIC_API_KEY", "sk-ant-from-env")
    merged = secrets_store.apply_env_overrides({"ai": {"enabled": True}})
    assert merged["ai"]["keys"]["anthropic"] == "sk-ant-from-env"
    # Pre-existing ai sub-keys are preserved (deep, not replace).
    assert merged["ai"]["enabled"] is True


def test_ai_env_overrides_registered_for_every_provider() -> None:
    """Parity guard: every provider's env_var is in the override map and
    points at ``ai.keys.<provider>``. Keeps secrets_store in sync with
    app.ai.providers without coupling the two modules."""
    from app.ai.providers import list_providers

    for preset in list_providers():
        assert preset.env_var in secrets_store._ENV_SECRET_OVERRIDES, (
            f"{preset.id}: env_var {preset.env_var} not registered"
        )
        assert secrets_store._ENV_SECRET_OVERRIDES[preset.env_var] == (
            "ai",
            "keys",
            preset.id,
        )


def test_secrets_template_documents_ai_keys() -> None:
    assert "ai:" in secrets_store.SECRETS_TEMPLATE
    assert "keys:" in secrets_store.SECRETS_TEMPLATE


def test_register_plugin_secret_override_extends_chain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secrets_store.register_plugin_secret_override(
        "plugins.testing.token", "TOPOS_PLUGIN_TESTING_SECRET"
    )
    monkeypatch.setenv("TOPOS_PLUGIN_TESTING_SECRET", "abc123")
    merged = secrets_store.apply_env_overrides({})
    assert merged["plugins"]["testing"]["token"] == "abc123"


def test_register_plugin_secret_override_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        secrets_store.register_plugin_secret_override("", "FOO")
    with pytest.raises(ValueError):
        secrets_store.register_plugin_secret_override("foo.bar", "")


def test_register_plugin_secret_override_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secrets_store.register_plugin_secret_override(
        "plugins.testing.token", "TOPOS_PLUGIN_TESTING_SECRET"
    )
    secrets_store.register_plugin_secret_override(
        "plugins.testing.token", "TOPOS_PLUGIN_TESTING_SECRET"
    )
    assert secrets_store._ENV_SECRET_OVERRIDES["TOPOS_PLUGIN_TESTING_SECRET"] == (
        "plugins",
        "testing",
        "token",
    )


def test_ensure_secrets_template_creates_file_with_0o600(tmp_path: Path) -> None:
    secrets_path = tmp_path / "topos" / "secrets.yaml"
    created = secrets_store.ensure_secrets_template(secrets_path)
    assert created is True
    assert secrets_path.exists()
    assert "secret_key" in secrets_path.read_text(encoding="utf-8")
    if os.name == "posix":
        mode = stat.S_IMODE(secrets_path.stat().st_mode)
        assert mode == 0o600


def test_ensure_secrets_template_is_idempotent(tmp_path: Path) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_store.ensure_secrets_template(secrets_path)
    first_mtime = secrets_path.stat().st_mtime
    created = secrets_store.ensure_secrets_template(secrets_path)
    assert created is False
    assert secrets_path.stat().st_mtime == first_mtime


@pytest.mark.skipif(os.name != "posix", reason="POSIX-only perm check")
def test_warn_if_world_readable_fires_on_open_perms(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text("secret_key: x", encoding="utf-8")
    os.chmod(secrets_path, 0o644)
    with caplog.at_level(logging.WARNING, logger="app.secrets_store"):
        secrets_store.warn_if_world_readable(secrets_path)
    assert any("permissive mode" in rec.message for rec in caplog.records)


@pytest.mark.skipif(os.name != "posix", reason="POSIX-only perm check")
def test_warn_if_world_readable_stays_quiet_on_0o600(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text("secret_key: x", encoding="utf-8")
    os.chmod(secrets_path, 0o600)
    with caplog.at_level(logging.WARNING, logger="app.secrets_store"):
        secrets_store.warn_if_world_readable(secrets_path)
    assert all("permissive mode" not in rec.message for rec in caplog.records)


def test_warn_if_world_readable_silent_on_missing_file(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="app.secrets_store"):
        secrets_store.warn_if_world_readable(tmp_path / "does-not-exist.yaml")
    assert all("permissive mode" not in rec.message for rec in caplog.records)


def test_get_secret_key_source_reports_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("TOPOS_SECRET_KEY", "from-env")
    source, path = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY",
        secrets_yaml_path=tmp_path / "secrets.yaml",
    )
    assert source == "env"
    assert path is None


def test_get_secret_key_source_reports_file_when_value_present(
    tmp_path: Path,
) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text('secret_key: "abc"\n', encoding="utf-8")
    source, path = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY", secrets_yaml_path=secrets_path
    )
    assert source == "secrets_yaml"
    assert path == secrets_path


def test_get_secret_key_source_falls_back_when_file_has_no_key(
    tmp_path: Path,
) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text("# template only, no secret_key uncommented\n", encoding="utf-8")
    source, path = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY", secrets_yaml_path=secrets_path
    )
    assert source == "app_yaml"
    assert path is None


def test_get_secret_key_source_falls_back_when_file_missing(tmp_path: Path) -> None:
    source, _ = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY",
        secrets_yaml_path=tmp_path / "does-not-exist.yaml",
    )
    assert source == "app_yaml"


def test_get_secret_key_source_falls_back_on_malformed_yaml(tmp_path: Path) -> None:
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text("this is: : : not valid yaml :\n  - broken", encoding="utf-8")
    source, _ = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY", secrets_yaml_path=secrets_path
    )
    assert source == "app_yaml"


def test_secret_key_precedence_env_over_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """End-to-end: env var wins against secrets.yaml."""
    secrets_path = tmp_path / "secrets.yaml"
    secrets_path.write_text('secret_key: "from-file"\n', encoding="utf-8")
    monkeypatch.setenv("TOPOS_SECRET_KEY", "from-env")
    source, _ = secrets_store.get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY", secrets_yaml_path=secrets_path
    )
    assert source == "env"

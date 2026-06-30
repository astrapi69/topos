"""Integration tests for the AI provider settings API.

Covers:
  GET  /api/settings/ai/providers   -> static presets (vision models)
  GET  /api/settings/ai/key-status  -> per-provider source (no values)
  POST /api/settings/ai/test        -> connectivity/key probe (mocked)
  PATCH /api/settings/app (ai)      -> deep-merge + strip managed keys
"""

from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient

from app import config_overlay
from app.ai import connection as ai_connection
from app.main import app
from app.routers import settings as settings_module

_AI_ENV_VARS = (
    "TOPOS_ANTHROPIC_API_KEY",
    "TOPOS_OPENAI_API_KEY",
    "TOPOS_GEMINI_API_KEY",
    "TOPOS_CUSTOM_API_KEY",
)


@pytest.fixture
def temp_base(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "plugins").mkdir()
    (config_dir / "app.yaml").write_text(
        yaml.dump(
            {
                "ai": {
                    "enabled": False,
                    "active_provider": "anthropic",
                    "keys": {"anthropic": "", "openai": "", "google": "", "custom": ""},
                    "models": {"anthropic": "claude-sonnet-4-6"},
                    "base_urls": {"custom": ""},
                }
            }
        )
    )
    return tmp_path


@pytest.fixture
def client(temp_base, monkeypatch):
    from app import main as main_module

    original_base = settings_module._base_dir
    original_manager = settings_module._manager
    original_project_cfg = config_overlay.get_project_config_dir()

    settings_module._base_dir = temp_base
    settings_module._manager = None
    config_overlay.set_project_config_dir(temp_base / "config")
    monkeypatch.setenv("TOPOS_DATA_DIR", str(temp_base))
    monkeypatch.setattr(main_module, "_get_user_override_path", lambda: temp_base / "secrets.yaml")
    for var in _AI_ENV_VARS:
        monkeypatch.delenv(var, raising=False)

    yield TestClient(app)

    settings_module._base_dir = original_base
    settings_module._manager = original_manager
    config_overlay.set_project_config_dir(original_project_cfg)


# --- GET /providers ---


def test_get_providers_returns_four(client):
    resp = client.get("/api/settings/ai/providers")
    assert resp.status_code == 200
    providers = resp.json()
    ids = {p["id"] for p in providers}
    assert ids == {"anthropic", "openai", "google", "custom"}


def test_get_providers_default_models_are_vision(client):
    resp = client.get("/api/settings/ai/providers")
    by_id = {p["id"]: p for p in resp.json()}
    anthropic = by_id["anthropic"]
    models = {m["id"]: m for m in anthropic["models"]}
    assert models[anthropic["default_model"]]["vision"] is True


def test_custom_provider_requires_base_url(client):
    resp = client.get("/api/settings/ai/providers")
    custom = next(p for p in resp.json() if p["id"] == "custom")
    assert custom["requires_base_url"] is True
    assert custom["models"] == []


# --- GET /key-status ---


def test_key_status_all_none_when_unconfigured(client):
    resp = client.get("/api/settings/ai/key-status")
    assert resp.status_code == 200
    statuses = {s["provider"]: s for s in resp.json()}
    assert set(statuses) == {"anthropic", "openai", "google", "custom"}
    assert all(s["source"] == "none" for s in statuses.values())
    assert all(s["configured"] is False for s in statuses.values())


def test_key_status_reports_env(client, monkeypatch):
    monkeypatch.setenv("TOPOS_ANTHROPIC_API_KEY", "sk-ant-env")
    resp = client.get("/api/settings/ai/key-status")
    anthropic = next(s for s in resp.json() if s["provider"] == "anthropic")
    assert anthropic["source"] == "env"
    assert anthropic["configured"] is True
    assert anthropic["externally_managed"] is True


# --- POST /test ---


def test_connection_test_ok(client, monkeypatch):
    monkeypatch.setattr(ai_connection, "_get", lambda *a, **k: 200)
    resp = client.post("/api/settings/ai/test", json={"provider": "anthropic", "api_key": "sk-x"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "error_code": None}


def test_connection_test_auth_error(client, monkeypatch):
    monkeypatch.setattr(ai_connection, "_get", lambda *a, **k: 401)
    resp = client.post("/api/settings/ai/test", json={"provider": "openai", "api_key": "bad"})
    assert resp.json() == {"ok": False, "error_code": "auth_error"}


def test_connection_test_missing_key(client):
    resp = client.post("/api/settings/ai/test", json={"provider": "anthropic"})
    assert resp.json() == {"ok": False, "error_code": "missing_key"}


def test_connection_test_uses_stored_key(client, monkeypatch):
    """A test with no api_key in the body falls back to the stored key."""
    client.patch("/api/settings/app", json={"ai": {"keys": {"anthropic": "sk-stored"}}})
    monkeypatch.setattr(ai_connection, "_get", lambda *a, **k: 200)
    resp = client.post("/api/settings/ai/test", json={"provider": "anthropic"})
    assert resp.json()["ok"] is True


# --- PATCH /settings/app (ai) ---


def test_patch_ai_keys_deep_merge(client):
    """Setting one provider's key must not wipe another's."""
    client.patch("/api/settings/app", json={"ai": {"keys": {"anthropic": "a"}}})
    client.patch("/api/settings/app", json={"ai": {"keys": {"openai": "b"}}})
    resp = client.get("/api/settings/app")
    keys = resp.json()["ai"]["keys"]
    assert keys["anthropic"] == "a"
    assert keys["openai"] == "b"


def test_patch_ai_preserves_other_ai_fields(client):
    client.patch("/api/settings/app", json={"ai": {"active_provider": "openai"}})
    resp = client.get("/api/settings/app")
    ai_block = resp.json()["ai"]
    assert ai_block["active_provider"] == "openai"
    # The seeded model mapping survives a key-only patch.
    assert ai_block["models"]["anthropic"] == "claude-sonnet-4-6"


def test_patch_strips_externally_managed_key(client, monkeypatch, temp_base):
    """A provider key managed via env must not be written to the overlay."""
    monkeypatch.setenv("TOPOS_GEMINI_API_KEY", "sk-env-managed")
    client.patch("/api/settings/app", json={"ai": {"keys": {"google": "leaked-from-ui"}}})

    on_disk = yaml.safe_load((temp_base / "config" / "app.yaml").read_text())
    assert on_disk["ai"]["keys"].get("google", "") != "leaked-from-ui"

    status = next(
        s for s in client.get("/api/settings/ai/key-status").json() if s["provider"] == "google"
    )
    assert status["source"] == "env"


def test_patch_writes_overlay_editable_key(client, temp_base):
    """A non-managed provider key is written to the user overlay."""
    client.patch("/api/settings/app", json={"ai": {"keys": {"openai": "sk-ui"}}})
    on_disk = yaml.safe_load((temp_base / "config" / "app.yaml").read_text())
    assert on_disk["ai"]["keys"]["openai"] == "sk-ui"

"""Settings API for reading and writing app and plugin configurations.

All writes route through ``app.config_overlay`` so the project
tree (``backend/config/...``) stays untouched at runtime. Reads
deep-merge project defaults + the user-overlay layer under
``get_data_dir() / "config"``. See the overlay module docstring
for the full rationale (dev-docker write-permission quirk +
filesystem-isolation rule).
"""

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import config_overlay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


_base_dir: Path = Path(".")
_manager: Any = None
_license_store: Any = None
_license_validator: Any = None


def configure(
    base_dir: Path, manager: Any, license_store: Any = None, license_validator: Any = None
) -> None:
    global _base_dir, _manager, _license_store, _license_validator
    _base_dir = base_dir
    _manager = manager
    _license_store = license_store
    _license_validator = license_validator


def _active_plugin_names() -> set[str]:
    """Get names of currently active plugins."""
    if not _manager:
        return set()
    return {p.name for p in _manager.get_active_plugins()}


# --- App Settings ---


@router.get("/app")
def get_app_settings() -> dict[str, Any]:
    """Get the full app configuration.

    Secret-key provenance lives at ``GET /settings/secret-source``;
    this endpoint returns the user-visible app config only.
    """
    return config_overlay.read_app_config_merged()


class AppSettingsUpdate(BaseModel):
    app: dict[str, Any] | None = None
    ui: dict[str, Any] | None = None
    author: dict[str, Any] | None = None
    plugins: dict[str, Any] | None = None
    ai: dict[str, Any] | None = None
    editor: dict[str, Any] | None = None
    # AR-02 Phase 2.1: settings-managed list of article topics. The
    # ArticleEditor topic dropdown reads from app.yaml topics: [...].
    topics: list[str] | None = None


class AddPenNameRequest(BaseModel):
    name: str


class SecretKeySourceResponse(BaseModel):
    """Where the running app's ``secret_key`` came from.

    ``source`` is one of ``env`` / ``secrets_yaml`` / ``app_yaml`` /
    ``auto_generated``. ``path`` is the absolute path of the secrets
    file when ``source == "secrets_yaml"``; ``null`` otherwise. The
    Settings page renders an info card from this payload.
    """

    source: str
    path: str | None
    env_var: str
    secrets_yaml_path: str


@router.get("/secret-source", response_model=SecretKeySourceResponse)
def get_secret_source() -> SecretKeySourceResponse:
    """Report the resolved ``secret_key`` source for the Settings UI.

    Topos does not expose a UI button to write the secret key; it is
    file-managed or env-var-managed only. The frontend renders a
    static info card whose label depends on this payload's ``source``.
    """
    from app.main import _get_user_override_path
    from app.secrets_store import get_secret_key_source

    secrets_path = _get_user_override_path()
    source, path = get_secret_key_source(
        env_var_name="TOPOS_SECRET_KEY", secrets_yaml_path=secrets_path
    )
    return SecretKeySourceResponse(
        source=source,
        path=str(path) if path is not None else None,
        env_var="TOPOS_SECRET_KEY",
        secrets_yaml_path=str(secrets_path),
    )


@router.post("/author/pen-name")
def add_pen_name(body: AddPenNameRequest) -> dict[str, Any]:
    """Add a pen name to the user's author profile.

    Used by the import wizard when an imported book references an
    author that is not in Settings: instead of dragging the user
    through a Settings detour mid-import, the wizard offers to add
    the unknown name as a new pen name on the existing profile.

    Behavior:
    - Empty / whitespace-only name -> 400.
    - Name equal to existing author.name -> idempotent, returns
      profile unchanged.
    - Name already in pen_names -> idempotent.
    - Otherwise appended to pen_names (preserves order).
    - When author.name is empty, the new value is set as the real
      name instead of appended (the schema's single-profile model
      treats real-name + pen-names as one identity; bootstrapping
      from zero authors should not leave the profile pen-names-
      only).

    Returns the updated `author:` block ({name, pen_names}).
    """
    cleaned = body.name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="name must be non-empty")

    current = config_overlay.load_app_config_for_edit()
    author = current.setdefault("author", {})
    name = (author.get("name") or "").strip()
    pen_names_raw = author.get("pen_names") or []
    pen_names = [n.strip() for n in pen_names_raw if isinstance(n, str) and n.strip()]

    if cleaned == name:
        return {"name": name, "pen_names": pen_names}
    if cleaned in pen_names:
        return {"name": name, "pen_names": pen_names}

    if not name:
        author["name"] = cleaned
    else:
        pen_names.append(cleaned)
        author["pen_names"] = pen_names

    config_overlay.write_user_app_config(current)
    config_overlay.refresh_manager_overlay(_manager)

    return {
        "name": author.get("name", "") or "",
        "pen_names": author.get("pen_names", []) or [],
    }


def _sanitize_ai_patch(ai_patch: dict[str, Any]) -> dict[str, Any]:
    """Drop externally-managed provider keys from an incoming ai patch.

    A provider key sourced from an env var or ``secrets.yaml`` must not
    be overwritten by a Settings UI write - the UI shows those as a
    read-only source card and never sends them, but we strip defensively
    in case a stale value reaches the endpoint. Keys stored in the user
    overlay (UI-editable) and all other ai fields pass through unchanged.
    """
    sanitized = dict(ai_patch)
    keys = sanitized.get("keys")
    if not isinstance(keys, dict):
        return sanitized

    from app.ai.config import is_ai_key_externally_managed
    from app.main import _get_user_override_path

    secrets_path = _get_user_override_path()
    kept: dict[str, Any] = {}
    for provider, value in keys.items():
        if is_ai_key_externally_managed(provider, secrets_yaml_path=secrets_path):
            logger.warning(
                "Stripped externally-managed AI key for provider '%s' from PATCH", provider
            )
            continue
        kept[provider] = value
    sanitized["keys"] = kept
    return sanitized


@router.patch("/app")
def update_app_settings(body: AppSettingsUpdate) -> dict[str, Any]:
    """Update app configuration (merges with existing)."""
    current = config_overlay.load_app_config_for_edit()

    if body.app is not None:
        current.setdefault("app", {}).update(body.app)
    if body.ui is not None:
        current.setdefault("ui", {}).update(body.ui)
    if body.author is not None:
        current.setdefault("author", {}).update(body.author)
    if body.plugins is not None:
        current.setdefault("plugins", {}).update(body.plugins)
    if body.ai is not None:
        sanitized_ai = _sanitize_ai_patch(body.ai)
        current["ai"] = config_overlay.deep_merge(current.get("ai") or {}, sanitized_ai)
    if body.editor is not None:
        current.setdefault("editor", {}).update(body.editor)
    if body.topics is not None:
        # Topics is a list - write whole, dedupe, drop empties.
        seen: set[str] = set()
        cleaned: list[str] = []
        for raw in body.topics:
            t = (raw or "").strip()
            if not t or t in seen:
                continue
            seen.add(t)
            cleaned.append(t)
        current["topics"] = cleaned

    config_overlay.write_user_app_config(current)

    # Reload config in the manager so changes take effect
    config_overlay.refresh_manager_overlay(_manager)

    return current


@router.delete("/ai/keys/{provider}")
def delete_ai_key(provider: str) -> dict[str, Any]:
    """Remove a user-managed AI provider key from the app-overlay config.

    Refuses externally-managed keys (env var / ``secrets.yaml``): those
    are stripped from writes, so deleting them here would silently do
    nothing and mislead the user into thinking the key was cleared.
    Idempotent - deleting an absent key is a no-op and still returns the
    current key status.
    """
    from app.ai.config import get_ai_key_status, is_ai_key_externally_managed
    from app.main import _get_user_override_path

    secrets_path = _get_user_override_path()
    if is_ai_key_externally_managed(provider, secrets_yaml_path=secrets_path):
        raise HTTPException(
            status_code=409,
            detail=(
                f"AI key for '{provider}' is managed externally "
                "(environment variable or secrets file) and cannot be deleted here."
            ),
        )

    current = config_overlay.load_app_config_for_edit()
    keys = current.get("ai", {}).get("keys")
    if isinstance(keys, dict) and provider in keys:
        del keys[provider]
        config_overlay.write_user_app_config(current)
        config_overlay.refresh_manager_overlay(_manager)

    return get_ai_key_status(provider, secrets_yaml_path=secrets_path)


# --- Plugin Settings ---


@router.get("/plugins")
def list_plugin_configs() -> dict[str, Any]:
    """List all plugin configurations with their settings.

    Returns the merged view (bundled defaults + user-overlay
    overrides) per plugin known via either layer.
    """
    result: dict[str, Any] = {}
    for plugin_name in config_overlay.list_merged_plugin_names():
        result[plugin_name] = config_overlay.read_plugin_config_merged(plugin_name)
    return result


@router.get("/plugins/discovered")
def list_discovered_plugins() -> list[dict[str, Any]]:
    """List plugins with configs that are registered (entry point, ZIP, or bundled)."""
    if not _manager:
        return []

    # Plugin discovery uses the MERGED app config so the UI reflects
    # Settings writes (enabled/disabled toggles, etc.) immediately
    # after a PATCH without waiting for a restart.
    app_config = config_overlay.read_app_config_merged()
    plugins_cfg = app_config.get("plugins", {})
    enabled = set(plugins_cfg.get("enabled", []) or [])
    disabled = set(plugins_cfg.get("disabled", []) or [])
    active = _active_plugin_names()
    available = _collect_available_plugins(active)

    result = []
    for name in config_overlay.list_merged_plugin_names():
        if name not in available:
            continue
        cfg = config_overlay.read_plugin_config_merged(name)
        tier = _resolve_license_tier(cfg)
        has_license = _check_plugin_license(name, tier)
        result.append(
            {
                "name": name,
                "has_config": True,
                "enabled": name in enabled and name not in disabled,
                "loaded": name in active,
                "license_tier": tier,
                "has_license": has_license,
            }
        )
    return result


def _collect_available_plugins(active: set[str]) -> set[str]:
    """Collect all available plugin names from entry points, ZIP installs, and bundled dirs."""
    try:
        available = set(_manager.list_available_plugins())
    except Exception:
        available = set()
    available |= active

    from app.routers.plugin_install import get_installed_plugins_dir

    installed_dir = get_installed_plugins_dir()
    if installed_dir.exists():
        for d in installed_dir.iterdir():
            if d.is_dir() and (d / "plugin.yaml").exists():
                available.add(d.name)

    bundled_dir = _base_dir.parent / "plugins"
    if bundled_dir.exists():
        for d in bundled_dir.iterdir():
            if d.is_dir() and d.name.startswith("topos-plugin-"):
                plugin_name = d.name.replace("topos-plugin-", "")
                pkg_dir = d / f"topos_{plugin_name.replace('-', '_')}"
                if (pkg_dir / "plugin.py").exists():
                    available.add(plugin_name)
    return available


def _resolve_license_tier(cfg: dict[str, Any]) -> str:
    """Resolve the license tier from a plugin's merged config dict.

    Explicit ``plugin.license_tier`` (``"core"`` / ``"premium"``)
    wins; otherwise fall back to ``plugin.license`` (``MIT``,
    ``Free`` -> ``core``; anything else -> ``premium``).
    """
    meta = cfg.get("plugin", {}) if isinstance(cfg.get("plugin"), dict) else {}
    explicit = meta.get("license_tier", "")
    if explicit in ("core", "premium"):
        return str(explicit)
    license_type = meta.get("license", "MIT")
    return "premium" if license_type not in ("MIT", "free", "Free") else "core"


def _check_plugin_license(name: str, tier: str) -> bool:
    """Check if a plugin has a valid license (core always True)."""
    if tier == "core":
        return True
    if not _license_store or not _license_validator:
        return False
    key = _license_store.get(name) or _license_store.get("*")
    if not key:
        return False
    try:
        _license_validator.validate_license(key, name)
        return True
    except Exception:
        wildcard = _license_store.get("*")
        if wildcard:
            try:
                _license_validator.validate_license(wildcard, "*")
                return True
            except Exception:
                pass
    return False


class PluginCreate(BaseModel):
    name: str
    display_name: str = ""
    description: str = ""
    version: str = "1.0.0"
    license: str = "MIT"
    settings: dict[str, Any] = {}


@router.post("/plugins")
def create_plugin_config(body: PluginCreate) -> dict[str, Any]:
    """Create a new plugin configuration file in the user overlay."""
    if config_overlay.plugin_config_exists(body.name):
        raise HTTPException(status_code=409, detail=f"Plugin config '{body.name}' already exists")

    config: dict[str, Any] = {
        "plugin": {
            "name": body.name,
            "display_name": body.display_name or body.name,
            "description": body.description,
            "version": body.version,
            "license": body.license,
            "depends_on": [],
            "api_version": "1",
        },
        "settings": body.settings,
    }

    config_overlay.write_user_plugin_config(body.name, config)
    return config


@router.delete("/plugins/{plugin_name}")
def delete_plugin_config(plugin_name: str) -> dict[str, str]:
    """Delete a plugin configuration and disable the plugin.

    Only the user-overlay copy is removed; bundled defaults in the
    project tree are left untouched. If the plugin only exists in
    the user overlay, this removes it entirely; if it has a bundled
    counterpart, subsequent reads will fall back to the bundled
    defaults.
    """
    if not config_overlay.plugin_config_exists(plugin_name):
        raise HTTPException(status_code=404, detail=f"Plugin config '{plugin_name}' not found")

    # Deactivate if active
    if _manager and plugin_name in _active_plugin_names():
        _manager.deactivate_plugin(plugin_name)

    # Remove from enabled list in the user overlay so the deletion
    # survives a restart.
    app_config = config_overlay.load_app_config_for_edit()
    enabled = app_config.get("plugins", {}).get("enabled", [])
    if plugin_name in enabled:
        enabled.remove(plugin_name)
        config_overlay.write_user_app_config(app_config)
        config_overlay.refresh_manager_overlay(_manager)

    config_overlay.delete_user_plugin_config(plugin_name)
    return {"plugin": plugin_name, "status": "removed"}


@router.get("/plugins/{plugin_name}")
def get_plugin_config(plugin_name: str) -> dict[str, Any]:
    """Get configuration for a specific plugin (merged view)."""
    if not config_overlay.plugin_config_exists(plugin_name):
        raise HTTPException(status_code=404, detail=f"Plugin config '{plugin_name}' not found")
    return config_overlay.read_plugin_config_merged(plugin_name)


class PluginSettingsUpdate(BaseModel):
    settings: dict[str, Any]


@router.patch("/plugins/{plugin_name}")
def update_plugin_settings(plugin_name: str, body: PluginSettingsUpdate) -> dict[str, Any]:
    """Update the ``settings`` section of a plugin config.

    Writes to the user-overlay layer only. The bundled defaults
    file in the project tree is never modified, so a future
    upstream change to ``settings:`` defaults reappears whenever
    the user-overlay file is removed.
    """
    if not config_overlay.plugin_config_exists(plugin_name):
        raise HTTPException(status_code=404, detail=f"Plugin config '{plugin_name}' not found")

    current = config_overlay.load_plugin_config_for_edit(plugin_name)
    current.setdefault("settings", {}).update(body.settings)
    config_overlay.write_user_plugin_config(plugin_name, current)

    # Update loaded plugin config if active
    if _manager:
        plugin = _manager.get_plugin(plugin_name)
        if plugin:
            plugin.config = current

    return current


# --- Plugin Enable/Disable ---


@router.post("/plugins/{plugin_name}/enable")
def enable_plugin(plugin_name: str) -> dict[str, str]:
    """Enable a plugin in the user-overlay app config."""
    config = config_overlay.load_app_config_for_edit()

    enabled = config.setdefault("plugins", {}).setdefault("enabled", [])
    disabled = config["plugins"].setdefault("disabled", [])

    if plugin_name not in enabled:
        enabled.append(plugin_name)
    if plugin_name in disabled:
        disabled.remove(plugin_name)

    config_overlay.write_user_app_config(config)
    config_overlay.refresh_manager_overlay(_manager)
    return {"plugin": plugin_name, "status": "enabled"}


@router.post("/plugins/{plugin_name}/disable")
def disable_plugin(plugin_name: str) -> dict[str, str]:
    """Disable a plugin in the user-overlay app config."""
    config = config_overlay.load_app_config_for_edit()

    enabled = config.setdefault("plugins", {}).setdefault("enabled", [])
    disabled = config["plugins"].setdefault("disabled", [])

    if plugin_name in enabled:
        enabled.remove(plugin_name)
    if plugin_name not in disabled:
        disabled.append(plugin_name)

    config_overlay.write_user_app_config(config)
    config_overlay.refresh_manager_overlay(_manager)

    # Deactivate the plugin if currently active
    if _manager and plugin_name in _active_plugin_names():
        _manager.deactivate_plugin(plugin_name)

    return {"plugin": plugin_name, "status": "disabled"}


# --- Helpers ---


# _refresh_manager_app_config used to live here; replaced in v0.10.0 by
# the shared config_overlay.refresh_manager_overlay() helper which uses
# PluginForge's public merge_app_config entry point.

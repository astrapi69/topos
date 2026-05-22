"""Topos backend application entry point.

Slim FastAPI shell. Phase 3 of the bootstrap rebuilds main.py around
the new Container/Item/Category/Action domain. The Phase 4 work adds
the four CRUD routers; this module's router-registration section is
deliberately empty until then.
"""

from __future__ import annotations

import logging
import os
import shutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pluginforge import BasePlugin, PluginManager
from pluginforge.config import load_i18n

from app import __version__
from app.database import init_db
from app.exceptions import ToposError
from app.hookspecs import ToposHookSpec
from app.licensing import LicenseError, LicenseStore, LicenseValidator
from app.logging_config import setup_logging
from app.middleware.body_size_limit import (
    BodySizeLimitMiddleware,
    _resolve_max_bytes_from_config,
)
from app.routers import (
    actions,
    categories,
    containers,
    items,
    licenses,
    plugin_install,
    settings,
)

setup_logging()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "app.yaml"
CONFIG_EXAMPLE_PATH = BASE_DIR / "config" / "app.yaml.example"

if not CONFIG_PATH.exists() and CONFIG_EXAMPLE_PATH.exists():
    shutil.copy2(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
    logger.info("Created config/app.yaml from app.yaml.example")

DEBUG = os.getenv("TOPOS_DEBUG", "true").lower() in ("true", "1", "yes")
CORS_ORIGINS = os.getenv("TOPOS_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
SECRET_KEY = os.getenv("TOPOS_SECRET_KEY", "")


def _get_user_override_path() -> Path:
    """Return the user-home secrets-override file path.

    XDG-conformant on Linux/macOS, ``%APPDATA%`` on Windows.
    """
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            return Path(appdata) / "topos" / "secrets.yaml"
        return Path.home() / "AppData" / "Roaming" / "topos" / "secrets.yaml"
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config) / "topos" / "secrets.yaml"
    return Path.home() / ".config" / "topos" / "secrets.yaml"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = dict(base)
    for key, override_value in override.items():
        base_value = out.get(key)
        if isinstance(base_value, dict) and isinstance(override_value, dict):
            out[key] = _deep_merge(base_value, override_value)
        else:
            out[key] = override_value
    return out


def _load_override_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except (yaml.YAMLError, OSError) as exc:
        logger.warning("Could not load override file %s: %s", path, exc)
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def _load_app_config() -> dict[str, Any]:
    """Read app.yaml + user overlay + secrets override.

    Higher layers win. Lists REPLACE; dicts deep-merge.
    """
    from app import config_overlay

    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            project = yaml.safe_load(f) or {}
    except Exception:
        project = {}
    user_overlay = config_overlay._read_yaml(config_overlay._user_app_path())
    override = _load_override_file(_get_user_override_path())
    merged = _deep_merge(project, user_overlay)
    merged = _deep_merge(merged, override)
    return merged


_startup_config = _load_app_config()
_license_secret = SECRET_KEY or _startup_config.get("licensing", {}).get(
    "secret_key", "pluginforge-default-key"
)
_license_file = _startup_config.get("licensing", {}).get("store_path", "config/licenses.json")
license_validator = LicenseValidator(_license_secret)
license_store = LicenseStore(BASE_DIR / _license_file)


def _check_license(plugin: BasePlugin, _plugin_config: dict[str, Any]) -> bool:
    """Pre-activate callback: permit core plugins, validate premium keys.

    Licensing is dormant during bootstrap; ``LICENSING_ENABLED`` in
    ``app.licensing`` is False and every plugin is treated as core.
    """
    from app.licensing import LICENSING_ENABLED

    if not LICENSING_ENABLED:
        return True

    tier = getattr(plugin, "license_tier", "core")
    if tier == "core":
        return True

    key = license_store.get(plugin.name) or license_store.get("*")
    if not key:
        logger.info("Premium plugin '%s' blocked: no license key", plugin.name)
        return False
    try:
        license_validator.validate_license(key, plugin.name)
        return True
    except LicenseError:
        logger.info("Premium plugin '%s' blocked: invalid/expired license", plugin.name)
        return False


manager = PluginManager(
    config_path=str(CONFIG_PATH),
    pre_activate=_check_license,
    api_version="1",
    app_id="topos",
    app_version=__version__,
)
manager.register_hookspecs(ToposHookSpec)


def _sync_manager_with_overlay() -> None:
    """Apply the user-overlay layer to the manager's app-config snapshot."""
    from app import config_overlay

    config_overlay.refresh_manager_overlay(manager, notify=False)


_sync_manager_with_overlay()

licenses.configure(manager, license_validator, license_store)
settings.configure(
    BASE_DIR,
    manager,
    license_store=license_store,
    license_validator=license_validator,
)
plugin_install.configure(BASE_DIR, manager)


def _load_installed_plugins() -> None:
    """Add ZIP-installed and bundled plugin directories to sys.path."""
    installed_dir = BASE_DIR / "plugins" / "installed"
    if installed_dir.exists():
        for plugin_dir in installed_dir.iterdir():
            if plugin_dir.is_dir() and (plugin_dir / "plugin.yaml").exists():
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)

    bundled_dir = BASE_DIR.parent / "plugins"
    if bundled_dir.exists():
        for plugin_dir in bundled_dir.iterdir():
            if plugin_dir.is_dir() and plugin_dir.name.startswith("topos-plugin-"):
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Topos (debug=%s)", DEBUG)
    from app.data_dir_migration import migrate_data_dir_if_needed
    from app.paths import mark_data_dir_as_production

    migrate_data_dir_if_needed()
    mark_data_dir_as_production()
    init_db()
    _load_installed_plugins()
    manager.discover_plugins()
    manager.mount_routes(app)
    active = [p.name for p in manager.get_active_plugins()]
    logger.info("Plugins loaded (%d): %s", len(active), ", ".join(active) or "none")
    yield
    logger.info("Shutting down Topos")
    manager.deactivate_all()


app = FastAPI(
    title="Topos",
    description="Personal inventory tracker for folders, boxes, and what's inside.",
    version=__version__,
    lifespan=lifespan,
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)

try:
    _max_upload_bytes = _resolve_max_bytes_from_config(_load_app_config())
except Exception as cfg_exc:
    logger.warning(
        "BodySizeLimitMiddleware: config load failed (%s); using default cap.",
        cfg_exc,
    )
    _max_upload_bytes = 500 * 1024 * 1024

app.add_middleware(BodySizeLimitMiddleware, max_bytes=_max_upload_bytes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(licenses.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(plugin_install.router, prefix="/api")

app.include_router(containers.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(actions.router, prefix="/api")


@app.exception_handler(ToposError)
async def topos_error_handler(request: Request, exc: ToposError):
    """Map typed domain errors to HTTP responses (per code-hygiene.md)."""
    if exc.status_code >= 500:
        logger.error("%s %s -> %s", request.method, request.url.path, exc.detail, exc_info=exc)
    else:
        logger.warning(
            "%s %s -> %s %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback

    logger.error(
        "Unhandled error: %s %s -> %s",
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )
    detail: dict[str, Any] = {"detail": str(exc)}
    if DEBUG:
        detail["stacktrace"] = traceback.format_exc()
        detail["endpoint"] = request.url.path
        detail["method"] = request.method
    return JSONResponse(status_code=500, content=detail)


@app.get("/api/plugins/manifests")
def get_plugin_manifests() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for plugin in manager.get_active_plugins():
        manifest = plugin.get_frontend_manifest()
        if manifest:
            result[plugin.name] = manifest
    return result


@app.get("/api/plugins/health")
def get_plugin_health() -> dict[str, Any]:
    return dict(manager.health_check())


@app.get("/api/plugins/errors")
def get_plugin_errors() -> dict[str, str]:
    return dict(manager.get_load_errors())


@app.get("/api/i18n/{lang}")
def get_i18n(lang: str) -> dict[str, Any]:
    return dict(load_i18n(BASE_DIR / "config", lang))


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "debug": DEBUG}

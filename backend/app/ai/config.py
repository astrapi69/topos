"""Reading the user's AI configuration from the merged app config.

The ``ai`` block lives in the four-layer config chain assembled by
``app.main._load_app_config`` (project app.yaml < user overlay <
secrets.yaml < env vars). This module reads that block and answers the
two questions the Settings layer needs:

  * what did the user configure (enabled, active provider, model)?
  * where does a given provider's API key come from, and is it managed
    externally (env / secrets.yaml) so the UI must not overwrite it?

API key *values* are never returned to the frontend - only their
source. Functions here take the merged config and secrets-file path as
arguments so they stay unit-testable without touching real files.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from app.ai.providers import get_provider

# Key-source labels, mirroring ``app.secrets_store`` so the frontend can
# reuse the same i18n strings for AI keys and the licensing secret.
KEY_SOURCE_ENV = "env"
KEY_SOURCE_SECRETS_YAML = "secrets_yaml"
KEY_SOURCE_APP_YAML = "app_yaml"
KEY_SOURCE_NONE = "none"


def get_ai_config(config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return the ``ai`` block of the merged app config.

    Args:
        config: An already-merged config dict. When ``None`` the merged
            config is loaded fresh via ``app.main._load_app_config`` so
            env/secrets/overlay layers are all applied.

    Returns:
        The ``ai`` mapping, or an empty dict when absent/malformed.
    """
    if config is None:
        from app.main import _load_app_config

        config = _load_app_config()
    ai_block = config.get("ai")
    return ai_block if isinstance(ai_block, dict) else {}


def is_ai_enabled(config: dict[str, Any] | None = None) -> bool:
    """True iff the user has switched AI features on."""
    return bool(get_ai_config(config).get("enabled", False))


def get_active_provider(config: dict[str, Any] | None = None) -> str:
    """Return the configured active provider id (defaults to ``anthropic``)."""
    provider = get_ai_config(config).get("active_provider")
    return provider if isinstance(provider, str) and provider else "anthropic"


def _secrets_file_has_ai_key(secrets_yaml_path: Path, provider_id: str) -> bool:
    """True iff ``secrets.yaml`` carries a non-empty ``ai.keys.<provider>``."""
    if not secrets_yaml_path.exists():
        return False
    try:
        with secrets_yaml_path.open(encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}
    except (yaml.YAMLError, OSError):
        # Malformed/unreadable secrets file: treat as "no key here" and
        # fall through to the next layer rather than crashing the probe.
        return False
    if not isinstance(data, dict):
        return False
    key = data.get("ai", {}).get("keys", {}).get(provider_id)
    return isinstance(key, str) and bool(key.strip())


def get_ai_key_status(
    provider_id: str,
    *,
    secrets_yaml_path: Path,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Report where a provider's API key comes from, without leaking it.

    Resolution order matches the config chain: env var > secrets.yaml >
    user overlay (app.yaml). ``env`` and ``secrets_yaml`` are considered
    externally managed - the Settings UI shows a read-only source card
    for those and the PATCH handler refuses to overwrite them.

    Args:
        provider_id: One of the built-in provider ids.
        secrets_yaml_path: Path to ``~/.config/topos/secrets.yaml``.
        config: The merged app config (loaded fresh when ``None``).

    Returns:
        ``{provider, configured, source, externally_managed}``. ``source``
        is one of ``env`` / ``secrets_yaml`` / ``app_yaml`` / ``none``.
    """
    preset = get_provider(provider_id)
    if preset is None:
        return {
            "provider": provider_id,
            "configured": False,
            "source": KEY_SOURCE_NONE,
            "externally_managed": False,
        }

    if preset.env_var and os.environ.get(preset.env_var):
        return _status(provider_id, KEY_SOURCE_ENV, externally_managed=True)

    if _secrets_file_has_ai_key(secrets_yaml_path, provider_id):
        return _status(provider_id, KEY_SOURCE_SECRETS_YAML, externally_managed=True)

    overlay_key = get_ai_config(config).get("keys", {}).get(provider_id)
    if isinstance(overlay_key, str) and overlay_key.strip():
        return _status(provider_id, KEY_SOURCE_APP_YAML, externally_managed=False)

    return _status(provider_id, KEY_SOURCE_NONE, externally_managed=False)


def is_ai_key_externally_managed(
    provider_id: str,
    *,
    secrets_yaml_path: Path,
    config: dict[str, Any] | None = None,
) -> bool:
    """True when the provider's key comes from env or secrets.yaml.

    The PATCH handler uses this to strip externally-managed keys from an
    incoming settings update so a UI write never clobbers an operator's
    env/secrets-file value.
    """
    status = get_ai_key_status(provider_id, secrets_yaml_path=secrets_yaml_path, config=config)
    return bool(status["externally_managed"])


def _status(provider_id: str, source: str, *, externally_managed: bool) -> dict[str, Any]:
    """Build a key-status dict (configured iff a source other than ``none``)."""
    return {
        "provider": provider_id,
        "configured": source != KEY_SOURCE_NONE,
        "source": source,
        "externally_managed": externally_managed,
    }

"""Topos secrets loading + env-var override layer.

Pattern lifted from Bibliogon's ``app.main._ENV_SECRET_OVERRIDES`` /
``_apply_env_overrides`` (the lineage the template grew from), then
adapted for Topos:

- No AI provider keys (Topos has no LLM integration).
- The map starts with one entry - the HMAC-licensing secret key -
  and is extended at plugin-activate time via
  ``register_plugin_secret_override``.
- The module also owns the template-generation + file-permission
  hardening that protect the user-home secrets file.

The actual chain ``project_yaml -> user_overlay -> secrets.yaml ->
env vars`` is still assembled in ``app.main._load_app_config``; this
module just provides the top of the chain plus the helpers that
manage the on-disk template.
"""

from __future__ import annotations

import logging
import os
import stat
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Mapping ``env_var_name -> dotted-path tuple into the merged config
# dict``. Mutable: plugins call ``register_plugin_secret_override`` from
# their ``activate()`` hook to extend the chain without editing this
# file. The seed entry covers the HMAC secret consumed by
# ``app.licensing``; Topos itself ships zero AI keys.
_ENV_SECRET_OVERRIDES: dict[str, tuple[str, ...]] = {
    "TOPOS_SECRET_KEY": ("secret_key",),
}

# Sentinel returned from ``get_secret_source`` when the secret comes
# from the project ``app.yaml`` fallback (the value Topos ships with
# so the dormant licensing infrastructure can boot).
SECRET_KEY_SOURCE_ENV = "env"
SECRET_KEY_SOURCE_FILE = "secrets_yaml"
SECRET_KEY_SOURCE_APP_YAML = "app_yaml"
SECRET_KEY_SOURCE_AUTO = "auto_generated"


def register_plugin_secret_override(config_path: str, env_var: str) -> None:
    """Register a plugin secret with the env-var override layer.

    ``config_path`` is the dotted path inside the merged config dict
    where the secret will land (e.g. ``"plugins.sync.auth_token"``).
    ``env_var`` is the environment-variable name that overrides it.

    Idempotent: re-registering the same config path replaces the
    previous mapping. Plugins call this from their ``activate()`` hook
    so the override layer is in place before any request hits the
    plugin's routes.
    """
    if not config_path or not env_var:
        raise ValueError("register_plugin_secret_override requires non-empty config_path + env_var")
    _ENV_SECRET_OVERRIDES[env_var] = tuple(config_path.split("."))
    logger.debug("Registered plugin secret override: %s -> %s", env_var, config_path)


def apply_env_overrides(config: dict[str, Any]) -> dict[str, Any]:
    """Overlay env-var values onto the merged config dict.

    Env-vars sit at the top of the config chain (project < overlay <
    secrets.yaml < env). Used for CI/Docker/12-Factor deployment where
    secrets come from the orchestrator. Returns a new dict; ``config``
    is not mutated.
    """
    out = dict(config)
    for env_name, path in _ENV_SECRET_OVERRIDES.items():
        env_value = os.environ.get(env_name)
        if env_value is None or env_value == "":
            continue
        cursor: dict[str, Any] = out
        for segment in path[:-1]:
            existing = cursor.get(segment)
            cursor[segment] = dict(existing) if isinstance(existing, dict) else {}
            cursor = cursor[segment]
        cursor[path[-1]] = env_value
    return out


# Template written to ``~/.config/topos/secrets.yaml`` on first start
# when the file is absent. Every value is commented so an empty file
# is a no-op for the loader; the user uncomments + edits as needed.
SECRETS_TEMPLATE = """# Topos - Secrets
# This file is never committed to git.
# Values configured here are loaded at startup and take precedence
# over defaults in app.yaml. Environment variables override this file.
#
# Uncomment and fill in your values below.

# secret_key: "generate-with-python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

# Plugin secrets (extend as needed):
# plugins:
#   excel_import:
#     some_credential: "..."
#   sync:
#     remote_url: "https://..."
#     auth_token: "..."
"""


def ensure_secrets_template(path: Path) -> bool:
    """Create ``path`` with a commented template + 0o600 perms when
    absent. Idempotent: a no-op if the file already exists.

    Returns True iff a new file was created.
    """
    if path.exists():
        return False
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(SECRETS_TEMPLATE, encoding="utf-8")
    except OSError as exc:
        logger.warning(
            "Could not create secrets template at %s: %s. "
            "Skipping; the override layer still works once the file is created by hand.",
            path,
            exc,
        )
        return False
    try:
        # 0o600 = owner read+write only. Best effort on Windows where
        # POSIX bits do not exist; chmod is a no-op there.
        os.chmod(path, 0o600)
    except OSError as exc:
        logger.warning("Could not chmod 0o600 on %s: %s", path, exc)
    logger.info("Secrets template created at %s. Edit the file to provide values.", path)
    return True


def warn_if_world_readable(path: Path) -> None:
    """Log a WARNING when ``path`` exists with permissions any group
    or other can read. POSIX-only; on Windows the check short-circuits.

    The warning lists the current permissions and the recommended
    ``chmod 600`` fix so the operator can act without consulting the
    docs.
    """
    if os.name != "posix":
        return
    try:
        st = path.stat()
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.warning("Could not stat %s for permission check: %s", path, exc)
        return
    mode = stat.S_IMODE(st.st_mode)
    # Owner-only read+write (0o600) OR owner-only read (0o400) are fine.
    # Anything that exposes group or other bits is reported.
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        logger.warning(
            "Secrets file %s has permissive mode %o. Run `chmod 600 %s` to restrict to the owner.",
            path,
            mode,
            path,
        )


def get_secret_key_source(
    *,
    env_var_name: str,
    secrets_yaml_path: Path,
) -> tuple[str, Path | None]:
    """Best-effort report of where the resolved ``secret_key`` came from.

    Used by the Settings page to label the secret-key source. The
    caller passes the env-var name (so the function does not hard-code
    ``TOPOS_SECRET_KEY``) and the path of the secrets file (so a unit
    test can point it elsewhere).

    Returns one of:
      - ``("env", None)`` - env var set
      - ``("secrets_yaml", path)`` - secrets file present and carries
        a non-empty ``secret_key``
      - ``("app_yaml", None)`` - falls back to the project default
      - ``("auto_generated", None)`` - same precedence as ``app_yaml``
        from the caller's POV; reserved for future
        Fernet-on-the-fly behaviour
    """
    if os.environ.get(env_var_name):
        return (SECRET_KEY_SOURCE_ENV, None)
    if secrets_yaml_path.exists():
        try:
            import yaml

            with secrets_yaml_path.open(encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            if (
                isinstance(data, dict)
                and isinstance(data.get("secret_key"), str)
                and data["secret_key"].strip()
            ):
                return (SECRET_KEY_SOURCE_FILE, secrets_yaml_path)
        except (yaml.YAMLError, OSError):
            # Malformed file falls through to the app.yaml tier.
            pass
    return (SECRET_KEY_SOURCE_APP_YAML, None)

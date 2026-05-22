# Configuration

Topos uses a four-layer config chain so secrets stay out of the
project tree.

```
+-------------------------------------------------------+
|  4. env vars (highest priority)                       |
|     TOPOS_SECRET_KEY                                  |
|     ...plus any TOPOS_PLUGIN_<NAME>_<KEY> a plugin    |
|     registered with secrets_store.                    |
+-------------------------------------------------------+
                       ^ overrides
+-------------------------------------------------------+
|  3. user secrets (gitignored)                         |
|     ~/.config/topos/secrets.yaml                      |
+-------------------------------------------------------+
                       ^ overrides
+-------------------------------------------------------+
|  2. user overlay (Settings-UI writes)                 |
|     <data_dir>/config/app.yaml                        |
+-------------------------------------------------------+
                       ^ overrides
+-------------------------------------------------------+
|  1. project defaults (committed)                      |
|     backend/config/app.yaml                           |
+-------------------------------------------------------+
```

Override-wins semantics: a value in a higher layer replaces the same
key from any lower layer. Lists are **replaced**, not merged.

## Where to put what

| Layer | Examples | Location |
|---|---|---|
| Project defaults | `app.name`, `app.default_language`, `app.max_upload_mb`, `plugins.enabled`, `ui.theme` | `backend/config/app.yaml` (committed) |
| User overlay | UI-driven Settings writes (theme picks, language picks, plugin enable/disable) | `<data_dir>/config/app.yaml` (auto-created, see `app.config_overlay`) |
| User secrets | `secret_key`, plugin credentials | `~/.config/topos/secrets.yaml` (auto-created template, never committed) |
| Env vars | CI / Docker / 12-factor secrets | `TOPOS_SECRET_KEY`, `TOPOS_PLUGIN_*` |

The Settings page renders an info card showing which layer the
`secret_key` actually came from, so an operator can tell at a glance
whether the file or an env var is in effect.

## ~/.config/topos/secrets.yaml

Topos writes a commented template to this path the first time the
backend starts. Every value is a comment; the file is a no-op for
the loader until you uncomment a line.

```yaml
# Topos - Secrets
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
```

The template path is XDG-conformant:

| Platform | Path |
|---|---|
| Linux / BSD (or any POSIX with `XDG_CONFIG_HOME` set) | `$XDG_CONFIG_HOME/topos/secrets.yaml` |
| Linux / BSD (default) | `~/.config/topos/secrets.yaml` |
| macOS | `~/.config/topos/secrets.yaml` (same XDG path; Topos does not yet honor `Library/Application Support`) |
| Windows | `%APPDATA%/topos/secrets.yaml` |

### File permissions

`ensure_secrets_template` writes the template with `0o600` (owner
read+write only) on POSIX. On every startup `warn_if_world_readable`
re-checks the bits and logs a WARNING if any group or other bits are
set, with the recommended `chmod 600` remediation.

### Top-level `secret_key`

Today the only first-class secret consumed by Topos itself is
`secret_key`. Topos uses it as the HMAC signing key for premium
plugin licenses; the licensing infrastructure ships dormant
(`LICENSING_ENABLED = False`), so the secret is reserved for future
work.

> **Warning:** the project ships with a hard-coded default
> (`pluginforge-default-key`) so the dormant licensing
> infrastructure can boot. **Replace the default `secret_key`
> before any production deployment.** Either set
> `TOPOS_SECRET_KEY` in the environment or put a real value
> into `~/.config/topos/secrets.yaml`.

Set it now if you want stability across restarts when licensing
is activated:

```yaml
secret_key: "your-fernet-or-hmac-key-here"
```

Or via env:

```bash
export TOPOS_SECRET_KEY="..."
```

### Plugin secrets

Plugins extend the env-override layer at runtime by calling
`app.secrets_store.register_plugin_secret_override(config_path,
env_var)` from their `activate()` hook. The dotted config_path lands
the resolved value at the matching path inside the merged config
dict, which the plugin can read via its standard PluginForge
`plugin_config` argument or by re-reading `app.main._load_app_config()`.

Example: a future sync plugin needs an auth token. In `activate()`:

```python
from app.secrets_store import register_plugin_secret_override

register_plugin_secret_override("plugins.sync.auth_token", "TOPOS_SYNC_TOKEN")
```

Operator config (highest priority first):

```bash
export TOPOS_SYNC_TOKEN="..."        # env (wins)
```

```yaml
# ~/.config/topos/secrets.yaml
plugins:
  sync:
    auth_token: "..."
```

The plugin sees `merged["plugins"]["sync"]["auth_token"]` resolved
from either source.

## Resolution chain in code

`app.main._load_app_config()` assembles the merge:

1. `backend/config/app.yaml` (project defaults).
2. `app.config_overlay._read_yaml(_user_app_path())` (user overlay).
3. `_load_override_file(_get_user_override_path())`
   (`~/.config/topos/secrets.yaml`).
4. `app.secrets_store.apply_env_overrides(...)` (env vars).

Each later step deep-merges over the previous one. The env layer is
keyed by `_ENV_SECRET_OVERRIDES`, which `register_plugin_secret_override`
extends at runtime.

## Diagnosing where a value came from

The Settings page reads `GET /api/settings/secret-source` and
displays one of:

- `Key from: environment` (env var set)
- `Key from: secrets.yaml` (file present, key non-empty)
- `Key from: app.yaml (default)` (falls back to the project default)
- `Key from: auto-generated` (reserved for future Fernet-on-the-fly)

When the source is `secrets_yaml` or `env`, the page also shows the
exact path or env-var name so the operator can edit the right thing.

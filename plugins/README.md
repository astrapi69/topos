# Plugins

This directory is empty by design. The plugin loader infrastructure
(`backend/app/hookspecs.py`, `backend/app/main.py` discovery via
PluginForge, `backend/app/import_plugins/` registry) is in place; no
plugin packages ship with the skeleton.

## Adding a plugin

A plugin is a separate Python package that declares an entry point
under the group `topos.plugins`.

Minimal layout:

```
plugins/topos-plugin-<name>/
├── pyproject.toml
├── topos_<name>/
│   ├── __init__.py
│   ├── plugin.py        # <Name>Plugin(BasePlugin) with hook impls
│   └── routes.py        # optional FastAPI router
└── tests/
    └── test_<name>.py
```

`plugin.py` skeleton:

```python
from pluginforge import BasePlugin


class HelloPlugin(BasePlugin):
    name = "hello"
    version = "0.1.0"
    target_application = "topos"   # required: host passes app_id="topos" and rejects plugins without a match
```

Plugins under v0.9.0 with the hard-filter engaged MUST declare
`target_application = "topos"` (or whatever the host's app_id is
after the CUSTOMIZE.md rename). Plugins without it are rejected
during registration with `missing_target_application`.

`pyproject.toml` entry-point declaration:

```toml
[tool.poetry.plugins."topos.plugins"]
<name> = "topos_<name>.plugin:<Name>Plugin"
```

Register the path-dep in `backend/pyproject.toml`:

```toml
topos-plugin-<name> = {path = "../plugins/topos-plugin-<name>", develop = true}
```

Enable in `backend/config/app.yaml`:

```yaml
plugins:
  enabled:
    - <name>
```

After editing pyproject: `cd backend && poetry lock && poetry install`.

## Plugin hookspecs

Hook signatures live in `backend/app/hookspecs.py`. Each carries
an `api_version` constant; bump it when changing a signature so
existing plugins fail loudly instead of silently misbehaving.

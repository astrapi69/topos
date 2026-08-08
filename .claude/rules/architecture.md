# Architecture rules

## Layered architecture (4 layers, ALWAYS respected)

```
1. Frontend        React 18 + TypeScript + Vite + Tailwind + Dexie
2. Backend         FastAPI + SQLAlchemy + SQLite + Pydantic v2
3. PluginForge     External PyPI package (pluginforge ^0.10.0), based on pluggy
4. Plugins         Standalone packages, registered via entry points
```

New features ALWAYS belong in a plugin, unless they touch the core
(Container/Item/Category/Action CRUD, the frontend storage service,
backup/restore, the UI shell).

## Two repositories

| Repo | Purpose | License |
|------|---------|---------|
| `pluginforge` | Application-agnostic plugin framework (PyPI) | MIT |
| `topos` | Personal inventory tracker, uses PluginForge | MIT (all plugins free during development) |

PluginForge is EXTERNAL. Changes to PluginForge are a separate repo and a separate release cycle. Topos pins `pluginforge ^0.10.0`.

## Backend (Python/FastAPI)

### Structure per plugin

```
plugins/topos-plugin-{name}/
  topos_{name}/
    plugin.py          # {Name}Plugin(BasePlugin), hook implementations
    routes.py          # FastAPI router (delegates to service functions)
    {module}.py        # business logic (no FastAPI code here)
  tests/
    test_{name}.py     # pytest tests
  pyproject.toml       # entry point: [project.entry-points."topos.plugins"]
```

### Rules

- Plugin class inherits from BasePlugin (pluginforge).
- Business logic in its own modules, NOT in routes.py.
- routes.py contains only FastAPI endpoints that delegate to service functions.
- Hook specs live in backend/app/hookspecs.py. Define new hooks there, with api_version.
- Pydantic v2 for all request/response schemas.
- SQLAlchemy models in backend/app/models/.
- Configuration via YAML (backend/config/plugins/{name}.yaml), NOT hardcoded.
- Extend i18n strings in backend/config/i18n/{lang}.yaml (8 languages: DE, EN, ES, FR, EL, PT, TR, JA).
- Plugin dependencies as a class attribute: `depends_on = ["excel-import"]`.
- All plugins are free (MIT). Licensing infrastructure exists but is dormant (`LICENSING_ENABLED = False`).

### Plugin installation (ZIP)

Third-party plugins are installed as a ZIP through Settings > Plugins:
1. The ZIP must contain: plugin.yaml, a Python package with plugin.py
2. Extraction to plugins/installed/{name}/
3. Config to config/plugins/{name}.yaml
4. Dynamic registration via sys.path + PluginManager
5. Plugin names: lowercase letters, digits, hyphens only
6. Path traversal check on ZIP paths

### Licensing

- Topos-specific, NOT part of PluginForge.
- Code in backend/app/licensing.py.
- HMAC-SHA256 signed license keys, offline-validatable.
- Licenses in config/licenses.json, managed through the Settings UI.
- Format: TOPOS-{PLUGIN}-v{N}-{base64 payload}.{base64 signature}

## Frontend (React/TypeScript)

### UI component strategy

| Library | Purpose |
|---------|---------|
| Radix UI | Unstyled accessible primitives (Dialog, Tabs, Dropdown, Select, Tooltip) |
| @dnd-kit | Drag-and-drop / list reordering (only where a list is user-orderable) |
| Lucide React | Icons |
| react-toastify | Toast notifications |
| Tailwind CSS | Utility classes (v3, Preflight disabled) - light/dark element styling |

Rejected: shadcn/ui (too opinionated for this stack), MUI (too opinionated), Ant Design (too heavy).

### Theming and styling

- 5 themes: Classic, Cool Modern, Nord, Notebook, Studio (each with Light + Dark = 10 variants). Notebook + Studio were added after the original "3 themes" doc. Audit recipe to verify the current count: `grep -oE 'data-app-theme="[a-z-]+"' frontend/src/styles/global.css | sort -u`.
- **Two coexisting layers:**
  1. **CSS custom properties** in `frontend/src/styles/global.css` drive the 5 app-themes (`data-app-theme`) and the shared component system (`.btn*`, AppDialog). These remain the source of truth for the multi-theme palettes.
  2. **Tailwind CSS v3** provides per-element utility classes (added 2026-06-29; the earlier "No Tailwind" rule was explicitly retired by the maintainer). Config in `frontend/tailwind.config.js`:
     - `darkMode: ["class", '[data-theme="dark"]']` - the `dark:` variant is keyed to the `data-theme="dark"` attribute on `<html>` (set by `hooks/useTheme.ts`), NOT a `.dark` class.
     - `corePlugins.preflight: false` - Tailwind's reset is DISABLED so it coexists with `global.css` without clobbering the hand-written base styles and `.btn` system.
     - **Token bridge (2026-07-18):** `theme.extend.colors` maps token utilities onto the CSS custom properties (`page`, `surface`/`surface-2`/`surface-hover`, `ink`/`ink-secondary`/`ink-muted`/`ink-inverse`, `accent`/`accent-hover`/`accent-light`/`accent-subtle`, `line`/`line-strong`, `danger`/`danger-strong`); `theme.extend.fontFamily` exposes `font-display`/`font-body`/`font-mono`. The variables flip with `data-theme="dark"`, so token-backed utilities need NO `dark:` colour variant.
- **Shared Tailwind class strings live in `frontend/src/ui/classes.ts`** (`btn`, `btnPrimary`, `btnDanger`, `btnText`, `input`, `link`, `muted`, `danger`, `badge`, `pill`, `card`, `selected`). All composed from the token bridge. Reuse these instead of inventing per-element strings.
- **Rule:** new components/elements use token-backed Tailwind classes (from `ui/classes.ts` where applicable). Fixed-palette utilities (`gray-*`, `blue-*`, `slate-*`) are forbidden for chrome colours; semantic status colours (green/yellow/red, always with a `dark:` variant) are the exception. `dark:` variants are for structural differences only (e.g. `bg-surface dark:bg-page` on inputs). Never rely on bare `<button>`/`<a>` colour (it falls back to dark-on-dark UA chrome - see lessons-learned). Inline `style` beats Tailwind utilities, so move colour out of inline `style` when theming an element.

### Plugin UI (manifest-driven)

Plugins declare UI extensions via get_frontend_manifest(); the frontend queries
/api/plugins/manifests. The main predefined slot is `settings_section`
(Settings > Plugins). A plugin can also mount its own backend route + a
dedicated page (the excel-import plugin mounts `POST /api/import/excel` behind
the Import page). For complex plugin UIs: Web Components as custom elements
(compiled JS bundle in the plugin ZIP).

### Component structure

- Pages in frontend/src/pages/ (Dashboard, ContainerList, ContainerDetail,
  ItemEditor, CategoryBrowse, Actions, Import, PhotoIntake, Settings).
- Shared components in frontend/src/components/.
- Data access ONLY through the storage service (`getStorage()`,
  `src/storage/`) - never `api.*` or `fetch()` directly in components. The
  typed API client (`api/client.ts`) is an implementation detail of
  `apiStorage`; the AI/vision + photo endpoints are the narrow exceptions that
  still call `api.*` directly (they have no dexie-mode equivalent).

### UX patterns for forms

- **Stepped / compact form** for creation: show the required fields first,
  keep optional fields in a collapsible ("More details").
- **Reason:** forms stay compact for quick creation, optional fields don't clutter it.
- **Example:** the container create form - required: external_id, label. Optional
  (collapsible): description, location, size_group, type, owner.
- **Collapsible:** Radix Collapsible (@radix-ui/react-collapsible) for expandable
  sections. Collapsed when opened.
- **Input fields with suggestions:** `<input>` + `<datalist>` for free text with
  dropdown suggestions (e.g. size_group). No hard select when custom values should
  be possible.
- **Conditional fields:** checkbox toggle for optional groups; values are reset when
  deactivated.

### State management

- Current: React state + props. No global state management.
- If global state becomes necessary: introduce Zustand, NOT Redux.
- Stores communicate through events or callbacks, not through direct imports.

## Persistence

- Backend (api-mode source of truth): SQLAlchemy + SQLite.
- Frontend storage service (`frontend/src/storage/`, `getStorage()` ->
  `IStorageService`): two impls, picked by
  `VITE_STORAGE_MODE=dexie` (GitHub Pages) > persisted `topos.storage_mode`
  > `api` default.
  - **api mode** (`apiStorage`): every call is an HTTP request; Dexie is a
    read-through cache (stale-while-revalidate) mirrored on read.
  - **dexie mode** (`dexieStorage`): Dexie IS the store - real offline-first
    CRUD in IndexedDB, persists across reloads, no backend, no demo data.
    Cascade + category semantics mirror `backend/app/services/*`; ids are
    local (max + 1 per table).
- No sync between modes (switching does not merge stores).
- Backup: `src/backup/` is dual-mode too (backend `/api/backup` or Dexie).

## Data flow

```
api mode:    UI (React) -> getStorage() [apiStorage] -> API client -> FastAPI
             router -> service/plugin -> SQLAlchemy -> SQLite
dexie mode:  UI (React) -> getStorage() [dexieStorage] -> Dexie (IndexedDB)
```

Unidirectional. No direct DB access from routers. No frontend code in the
backend. Pages/components call `getStorage().<entity>.<op>` - NEVER `api.<entity>`
or `db.*` directly (the storage seam is what makes both deployments work).

## Error handling

```
Frontend       ApiError (status + detail) -> toast for the user
API client     HTTP error -> converted to ApiError
Router         Thin, catches nothing. Global exception handler maps.
Service        Throws ToposError subclasses (NotFoundError, ExportError, ...)
Plugin         Throws PluginError(plugin_name, message)
External       ExternalServiceError(service, message) for AI providers (Anthropic/OpenAI/Google/Perplexity vision)
```

Services NEVER throw HTTPException, routers catch NOTHING. The global exception handler in main.py maps ToposError subclasses to HTTP status codes. See code-hygiene.md "Error handling architecture" for details.

## Plugin package versions

Plugin versions are independent of the app version. A plugin is bumped only when the plugin itself changed, not on every app release. Concretely:

- No forced bump of every `plugins/topos-plugin-*/pyproject.toml` on an app release
- Plugin versions stay at `1.0.0` until there is a real reason to raise them (new hook version, breaking change in the plugin API, ...)
- The app version bump only touches `backend/pyproject.toml`, `frontend/package.json` and optionally `backend/app/__init__.py`
- Plugin changes are recorded in the app CHANGELOG, but the plugin version string stays unchanged

Reason: plugins have their own lifecycles, and trial keys / license keys are bound to the plugin name, not to the version. A bump without a change would only create noise.

## Plugin settings visibility

Every plugin setting in `config/plugins/*.yaml` MUST either:

1. Be editable in the plugin UI (Settings > Plugins > {plugin name}), OR
2. Be marked with a `# INTERNAL` comment to signal that it can only be edited via YAML.

Hidden settings that influence user behavior without a UI are forbidden. A setting that has a default value and changes how the app behaves MUST be visible and editable by the user.

Exceptions are allowed only for:
- Debug and development settings (marked `# INTERNAL`)
- Performance-tuning parameters that only power users should touch (marked `# INTERNAL` + comment)
- Initialization values or pipeline mappings that are not a user configuration target

Dead settings (fields in the YAML that the code never reads) are forbidden. When adding a new setting, ALWAYS verify that the code reads it; when removing a feature, ALWAYS remove the corresponding YAML field with it.

Per-entity vs global: settings that should vary per container/item do NOT belong in `config/plugins/*.yaml` but as a column on the relevant model (Container/Item/...). Plugin-global YAML settings are only for values that must be the same for ALL entities.

## Offline/local-first

- SQLite as the default backend DB (no external DB required).
- Frontend deliverable as static files.
- The GitHub Pages PWA is a real offline-first app: built with
  `VITE_STORAGE_MODE=dexie`, so `getStorage()` resolves to `dexieStorage` and
  all CRUD persists to IndexedDB with no backend. Do NOT reintroduce demo
  data (the old `DemoSeeder` + "connect a backend for real data" toast were
  removed; offline Dexie IS real storage). `seed.ts` stays only for
  `BackendUrlSettings.clearDemoData`.
- AI in dexie mode is browser-direct (only Anthropic; openai/google/perplexity
  are `corsBlocked` -> backend-only). The passphrase-encrypted local key vault
  (`@astrapi69/ai-key-vault`) stores keys in the browser.
- License validation offline (signed keys, no license server).

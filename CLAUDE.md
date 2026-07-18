# Topos

Personal inventory tracker for physical storage (file folders,
archive boxes, drawers) and the items they hold. Runs as an
offline-first PWA in the browser and as a cross-platform desktop
app via a PyInstaller launcher.

- **Repository:** https://github.com/astrapi69/topos
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md)
- **Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md)
- **Configuration:** [docs/configuration.md](docs/configuration.md)
- **API reference:** FastAPI OpenAPI under `/api/docs`

## Ecosystem

Topos is part of a small family of MIT-licensed projects:

- **[pluginforge](https://github.com/astrapi69/pluginforge)** - application-agnostic plugin framework, distributed via PyPI. The runtime backbone of Topos.
- **[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)** - the scaffold Topos was bootstrapped from.
- **[adaptive-learner](https://github.com/astrapi69/adaptive-learner)** - sibling application built on the same template (the patterns in `.claude/rules/` originated there).
- **[bibliogon](https://github.com/astrapi69/bibliogon)** - book-authoring sibling. The Topos bootstrap inherited the template that bibliogon's lineage produced.

## Development guidelines

Detailed rules live in `.claude/rules/`. They generalise patterns
learned in `adaptive-learner` / `bibliogon`. Prune entries that turn
out to be specific to those projects' domains.

**Always relevant** (read on every feature/fix):
- `architecture.md` - layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` - naming, function design, tests, dependencies

**On demand** (read for specific tasks):
- `code-hygiene.md` - linting, pre-commit, error handling architecture, API conventions
- `lessons-learned.md` - known pitfalls (template-lineage; prune as Topos accumulates its own)
- `quality-checks.md` - test strategy, mutmut/Stryker, pre-commit checklists
- `ai-workflow.md` - order for features/plugins, prohibitions, docs protocol
- `release-workflow.md` - release process (triggered by "release new version")

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Alembic, Poetry
- **Frontend:** React 18+, TypeScript (strict), Vite, Radix UI, Tailwind CSS (v3, Preflight off), Dexie, Lucide, react-toastify
- **Plugins:** pluginforge ^0.10.0 (PyPI), entry-point group `topos.plugins`. Host passes `app_id="topos"` + `app_version`; plugins must declare `target_application = "topos"` or are filtered at activation. User-overlay applied via `config_overlay.refresh_manager_overlay(manager)`.
- **Launcher:** PyInstaller cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest (backend + plugins), Vitest (frontend), Playwright (e2e)
- **Tooling:** Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit

## Architecture (short)

Four layers: Frontend → Backend → PluginForge → Plugins. Details in
`.claude/rules/architecture.md`. Backend is the source of truth;
Dexie on the frontend is a read-through cache (no offline mutation
queue, no CRDT). Licensing infrastructure exists but is dormant
(`LICENSING_ENABLED = False`).

## Commands

```bash
make install              # Poetry (backend + launcher) + npm (frontend)
make dev                  # backend (8010) + frontend (5183) in parallel
make test                 # backend pytest + frontend Vitest
make test-backend         # backend only
make test-frontend        # Vitest
make prod                 # Docker Compose
make help                 # all targets
```

E2E (needs a running app): `npx playwright test` from `e2e/`.

## Session start

1. `git log --oneline -10` - recent changes
2. `make test` - green baseline (322 backend + 27 plugin + 90 frontend Vitest as of v0.1.0)
3. Read this file + relevant rules per the task

## Data model

Four entities under `backend/app/models/`:

- **Container** - a folder or box. Numeric `external_id`, `type` ∈ {folder, box}, `owner` ∈ {self, parents, shared}, `label`, optional `description`/`location`/`size_group`.
- **Item** - a content line attached to a container. `content`, `priority` ∈ {none, low, medium, high, very_high}, optional `category_path` (slash-separated slug), optional `notes`. Cascade-deletes with the container.
- **Category** - node in the hierarchical taxonomy. Canonical English `path`, `parent_path` link, `name`, `display_name` (German by default), `level`. The tree is built on demand via `GET /api/categories/tree`.
- **Action** - pending or completed follow-up tied to an item. `text`, `status` ∈ {open, done, archived}, optional `due_date` and `completed_at`. Cascade-deletes with the item.

Items reference categories loosely (just the slug). The same path
survives an item moving containers.

## Plugins

Topos ships one plugin: [`topos-plugin-excel-import`](plugins/topos-plugin-excel-import/).
Mounts `POST /api/import/excel`, imports `Ordner-Ordnung.xlsx` (or
any workbook in the same three-sheet shape) idempotently. Future
plugins (QR labels, photo attachments, CSV import) follow the same
PluginForge entry-point pattern; see `plugins/topos-plugin-excel-import/`
for the minimal layout.

Plugin secrets register at activation via
`app.secrets_store.register_plugin_secret_override(config_path, env_var)`
- the resolved value lands at the matching dotted path in the
merged config dict. See [docs/configuration.md](docs/configuration.md).

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with
PyInstaller. Produces a single-file installer-launcher binary per OS
that bootstraps the backend, opens the frontend in the user's
browser, and manages auto-update + uninstall.

- **Spec:** `launcher/topos-launcher.spec`
- **Python package:** `launcher/topos_launcher/`
- **Per-OS build pipelines:** `.github/workflows/launcher-{linux,macos,windows}.yml`
- **Embedded version:** injected at build time from `backend/pyproject.toml`
- **User-facing install scripts:** `install.sh` (Linux), `install.command` (macOS), `install.cmd` + `install.ps1` (Windows)

## Directory structure (short)

```
topos/
├── backend/app/           # FastAPI core (main, database, models, routers, services, secrets_store)
├── backend/config/        # app.yaml, i18n/ (8 languages)
├── backend/migrations/    # Alembic baseline
├── backend/tests/         # backend tests (models/, routers/, plus infrastructure tests)
├── plugins/               # topos-plugin-excel-import
├── frontend/src/
│   ├── api/client.ts      # typed API client (snake_case↔camelCase boundary)
│   ├── components/        # NavBar (top bar + mobile bottom tab bar), AppDialog, FormField, ...
│   ├── db/schema.ts       # Dexie cache
│   ├── hooks/useTopos.ts  # stale-while-revalidate hooks
│   ├── pages/             # Dashboard, ContainerList, ContainerDetail, ItemEditor, CategoryBrowse, Actions, Import, Settings
│   ├── ui/classes.ts      # shared Tailwind class strings (light+dark)
│   └── styles/global.css  # CSS variables, themes, @tailwind directives
├── e2e/                   # Playwright spec (import-roundtrip)
├── launcher/              # cross-OS PyInstaller launcher
├── docs/                  # CONCEPT, ROADMAP, configuration
└── Makefile, docker-compose.yml, install.{sh,cmd,ps1,command}
```

## Core conventions

- i18n: 8 languages in `backend/config/i18n/{lang}.yaml`. DE + EN fully populated; the other 6 carry EN as placeholders. DE uses real umlauts.
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns
- TypeScript: strict mode, no `any`, Radix UI for primitives
- Styling: CSS custom properties in `styles/global.css` are the single colour source (default palette: cool slate + Blue-800 accent, matching the PWA theme-color). `tailwind.config.js` bridges them into token utilities (`bg-surface`, `text-ink`, `border-line`, `bg-accent`, ...); `src/ui/classes.ts` composes the shared button/input/badge/card strings from them. Colours flip with `data-theme="dark"` via the variables - `dark:` variants only where the structure differs, not for palette. Fixed-palette Tailwind colours (gray-*/blue-*) are forbidden; semantic status colours (green/yellow/red badges) are the exception. Type pairing: JetBrains Mono (display, headings via the global type scale) + DM Sans (body), both bundled locally. See architecture.md "Theming and styling".
- Commits: English, conventional (feat/fix/refactor/docs)
- E2E: `data-testid` selectors only
- Secrets NEVER in committed config files. Four-layer chain: project `backend/config/app.yaml` < user overlay (`<data_dir>/config/app.yaml`) < `~/.config/topos/secrets.yaml` (gitignored, auto-templated at 0o600) < env-vars. Env-overrides are keyed by `app.secrets_store._ENV_SECRET_OVERRIDES`; plugins extend the map via `register_plugin_secret_override(config_path, env_var)` from their `activate()`. The Settings page renders the resolved source label via `GET /api/settings/secret-source`. Full doc in [docs/configuration.md](docs/configuration.md).

## Tests

- `make test` must stay green after every change
- E2E tests under `e2e/`, not on the `make test` default path. Run with `npx playwright test`

## Test isolation

Tests run in a temporary data directory, never against production
data. Two layers of protection in `backend/tests/conftest.py`:

1. `TOPOS_TEST=1` + `TEST_DATABASE_URL=sqlite:///:memory:` set BEFORE any `app.*` import. `TOPOS_DATA_DIR` set to a process-scoped tmp dir.
2. Production data directories carry a `.topos-production` marker file. If any test ever sees this marker, the run aborts with `pytest.exit(returncode=2)`.

Path conventions: `Path("uploads")` is forbidden (CWD-relative).
Use `app.paths.get_upload_dir()`. Frozen module-level imports of
paths are forbidden - use the helper functions.

## Pre-commit hooks

```bash
cd backend && poetry run pre-commit install
```

Hooks: trailing-whitespace, end-of-file-fixer, check-yaml/json,
check-merge-conflict, ruff (with `--fix`), ruff-format, plus
project-local hooks (roadmap-archive reminder, plugin-lock pairing,
theme-token completeness, notify-error-passes-error). The
`plugin-lock-paired-with-pyproject` hook will block a commit that
stages `plugins/topos-plugin-<name>/pyproject.toml` without also
staging the paired `poetry.lock`.

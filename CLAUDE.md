# PluginForge App Template

Reusable project scaffold for building plugin-driven, full-stack applications with [PluginForge](https://github.com/astrapi69/pluginforge). Ships a clean FastAPI + React + TypeScript skeleton with CRUD, settings, i18n, tests, CI, cross-OS launcher, and Docker deployment — domain models marked `EXAMPLE-DOMAIN` for the user to replace.

- **Repository:** https://github.com/astrapi69/pluginforge-app-template
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md)
- **Customization guide:** [CUSTOMIZE.md](CUSTOMIZE.md) — read this first after cloning
- **API reference:** FastAPI OpenAPI under `/docs` and `/openapi.json`

## Ecosystem

This template is part of a small family of MIT-licensed projects:

- **[pluginforge](https://github.com/astrapi69/pluginforge)** — application-agnostic plugin framework, distributed via PyPI. The runtime backbone of this template.
- **[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)** (this repo) — generic full-stack scaffold for new PluginForge applications.
- **[adaptive-learner](https://github.com/astrapi69/adaptive-learner)** — reference downstream application built on this template (the patterns in `.claude/rules/` evolved there).
- **[bibliogon](https://github.com/astrapi69/bibliogon)** — book-authoring application from which the original skeleton was extracted. Acknowledged here for attribution; not a runtime dependency.

In `topos` (the placeholder name throughout this template), `topos_*` env vars, `topos.plugins` entry-point group, and `Topos` UI strings, the literal `topos` is meant to be globally renamed by the user (see `CUSTOMIZE.md`).

## Development guidelines

Detailed rules live in `.claude/rules/`. They generalise patterns learned in `adaptive-learner` / `bibliogon`; prune entries that turn out to be domain-specific to your application.

**Always relevant** (read on every feature/fix):
- `architecture.md` — layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` — naming, function design, tests, dependencies

**On demand** (read for specific tasks):
- `code-hygiene.md` — linting, pre-commit, error handling architecture, API conventions
- `lessons-learned.md` — known pitfalls (carried over; prune as you customize)
- `quality-checks.md` — test strategy, mutmut/Stryker, pre-commit checklists
- `ai-workflow.md` — order for features/plugins, prohibitions, docs protocol
- `release-workflow.md` — release process (triggered by "release new version")

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry
- **Frontend:** React 18+, TypeScript (strict), Vite, Radix UI, @dnd-kit, Lucide, react-toastify
- **Plugins:** pluginforge ^0.10.0 (PyPI), entry points under group `topos.plugins`. Host passes `app_id="topos"` + `app_version`, so plugins must declare `target_application = "topos"` or they are rejected with `missing_target_application`. The user-overlay layer is applied via `config_overlay.refresh_manager_overlay(manager)` which wraps PluginForge v0.10.0's `merge_app_config()` public API (replaces the prior `manager._app_config = ...` private-attribute write).
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright, mutmut, Stryker
- **Tooling:** Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit
- **Docs site:** MkDocs (`mkdocs.yml`, `docs/pyproject.toml` carries the docs venv)

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in `.claude/rules/architecture.md`.

Lean core (UI, CRUD, settings, plugin loader). Everything domain-specific should ship as a plugin. Licensing infrastructure exists but is dormant (`LICENSING_ENABLED = False`).

## Commands

```bash
make install              # Poetry + npm + plugins
make dev                  # backend (8000) + frontend (5173) in parallel
make dev-bg / dev-down    # background mode
make test                 # backend + frontend, no coverage
make test-coverage        # opt-in coverage run
make test-backend         # backend only
make test-frontend        # Vitest
make prod                 # Docker Compose
make prod-down            # stop Docker
make clean                # remove build artifacts
make help                 # all targets
```

E2E tests: `npx playwright test --project=smoke` or `--project=full`.

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + relevant rules per the task

## Data model (EXAMPLE-DOMAIN, replace per project)

The skeleton ships with a content-authoring example domain so the wiring (model → router → service → frontend → tests) is concrete. Replace each entity with your own domain concepts. See `CUSTOMIZE.md` Step 3.

- **Book / Chapter / Article / ArticleComment / Author / Asset** — example entities demonstrating CRUD, soft-delete, parent/child, file uploads, and i18n
- **Settings:** layered config (project YAML < user override < env-vars)

## Plugins

The skeleton ships with **zero plugins**. The loader infrastructure (`backend/app/hookspecs.py`, PluginForge bootstrap in `backend/app/main.py`, `backend/app/import_plugins/` registry) is in place; add plugins as your domain matures. See `plugins/README.md` for the minimal plugin layout.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with PyInstaller. Produces a single-file installer-launcher binary per OS that bootstraps the backend, opens the frontend in the user's browser, and manages auto-update + uninstall.

- **Spec:** `launcher/topos-launcher.spec` (PyInstaller)
- **Python package:** `launcher/topos_launcher/`
- **Per-OS build pipelines:** `.github/workflows/launcher-{linux,macos,windows}.yml` build artifacts on release tags
- **Embedded version:** injected at PyInstaller build time from `backend/pyproject.toml` via the spec (no hardcoded literal)
- **User-facing install scripts:** `install.sh` (Linux), `install.command` (macOS), `install.cmd` + `install.ps1` (Windows) — generated from `*.template` files at release time

## Directory structure (short)

```
pluginforge-app-template/
├── backend/app/           # FastAPI core (main, database, hookspecs, models, routers, services)
├── backend/config/        # app.yaml, i18n/ (multiple languages)
├── backend/tests/         # backend tests
├── plugins/               # empty placeholder + README
├── frontend/src/
│   ├── api/client.ts      # typed API client
│   ├── components/        # shared UI primitives
│   ├── pages/             # Dashboard, Editor, Settings
│   └── styles/global.css  # CSS variables, themes
├── e2e/                   # Playwright specs (smoke + full)
├── launcher/              # cross-OS PyInstaller launcher
├── docs/                  # MkDocs site (CONCEPT, ROADMAP, API, help/*, audits/*)
├── scripts/               # ROADMAP archival, mkdocs nav generator, audits, version sync
├── .github/workflows/     # CI/CD: ci, coverage, docs, launcher-{linux,macos,windows}, release-gate
└── Makefile, docker-compose.yml, docker-compose.prod.yml,
    install.{sh,cmd,ps1,command}, start.sh, stop.sh, .env.example
```

## Core conventions

- i18n: multiple languages, all UI strings in `backend/config/i18n/{lang}.yaml`
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns
- TypeScript: strict mode, no `any`, Radix UI for primitives
- CSS: custom properties, dark mode via `[data-theme="dark"]`
- Commits: English, conventional (feat/fix/refactor/docs)
- E2E: `data-testid` selectors only
- Secrets NEVER in committed config files. Three-layer chain: project `backend/config/app.yaml` (defaults) < `~/.config/topos/secrets.yaml` (user override, gitignored) < env-vars (`TOPOS_*`).

## Tests

- `make test` must stay green after every change
- E2E tests under `e2e/`, not on the `make test` default path

## Test isolation

Tests run in a temporary data directory, never against production data. Two layers of protection in `backend/tests/conftest.py`:

1. `TOPOS_TEST=1` + `TEST_DATABASE_URL=sqlite:///:memory:` set BEFORE any `app.*` import. `TOPOS_DATA_DIR` set to a process-scoped tmp dir.
2. Production data directories carry a `.topos-production` marker file. If any test ever sees this marker, the run aborts with `pytest.exit(returncode=2)`.

Path conventions: `Path("uploads")` is forbidden (CWD-relative). Use `app.paths.get_upload_dir()`. Frozen module-level imports of paths are forbidden — use the helper functions.

## Pre-commit hooks

```bash
cd backend && poetry run pre-commit install
```

Hooks: trailing-whitespace, end-of-file-fixer, check-yaml/json, check-merge-conflict, ruff (with `--fix`), ruff-format. Backend-only.

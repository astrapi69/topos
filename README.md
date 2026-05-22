# PluginForge App Template

Production-ready project scaffold for building plugin-driven, full-stack applications on top of [PluginForge](https://github.com/astrapi69/pluginforge). Ships a clean FastAPI + React + TypeScript skeleton with CRUD, settings, i18n, tests, CI, cross-OS launcher, and Docker deployment. Domain models ship as `EXAMPLE-DOMAIN` — replace per project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Quick start

```bash
# Clone and bootstrap as your own repo
git clone https://github.com/astrapi69/pluginforge-app-template.git my-app
cd my-app
rm -rf .git && git init

# Read the customization guide BEFORE running make install
cat CUSTOMIZE.md
```

Then follow [CUSTOMIZE.md](CUSTOMIZE.md) for the global rename, EXAMPLE-DOMAIN replacement, and first-plugin steps. After customization:

```bash
make install              # Poetry (backend + launcher) + npm (frontend)
make test                 # backend pytest + frontend vitest
make dev                  # backend on :8000, frontend on :5173
```

## What's included

### Backend
- **FastAPI** app with layered architecture (routers → services → models)
- **SQLAlchemy 2.0** mapped columns + **Alembic** migrations
- **Pydantic v2** schemas for request/response validation
- **PluginForge** integration: hookspec discovery, entry-point loader, plugin-lifecycle management
- **Layered configuration**: project YAML < user override (`~/.config/myapp/`) < env-vars (`MYAPP_*`)
- **Test isolation**: tmp-dir data dir + production marker tripwire + in-memory test DB
- **i18n**: 8 languages (DE, EN, ES, FR, EL, PT, TR, JA) in `backend/config/i18n/*.yaml`
- **Soft-delete + trash lifecycle** on EXAMPLE-DOMAIN entities (Book, Article, Comment)
- **Backup / restore** scaffolding (`backup_history` model + service)
- **Licensing** infrastructure (HMAC-signed offline-validatable keys, dormant by default)

### Frontend
- **React 18 + TypeScript (strict)** with Vite build pipeline
- **Radix UI** primitives (Dialog, Tabs, Dropdown, Select, Tooltip)
- **@dnd-kit** for drag-and-drop, **Lucide React** for icons, **react-toastify** for feedback
- **Theming**: CSS custom properties, multiple palettes × light/dark variants
- **Typed API client** at `frontend/src/api/client.ts` with `ApiError` class and toast-friendly error chain
- **i18n hook** (`useI18n`) reading the backend YAML catalogs

### Plugin system
- **Zero plugins ship** — the loader is wired and ready
- `plugins/README.md` documents the minimal plugin layout
- Hook specs at `backend/app/hookspecs.py`; entry-point group `myapp.plugins`

### Launcher
- **Cross-OS PyInstaller launcher** under `launcher/` (Linux + macOS + Windows)
- Bootstraps the backend, opens the frontend in the user's browser, manages auto-update + uninstall
- Per-OS build pipelines: `.github/workflows/launcher-{linux,macos,windows}.yml`
- Single-source-of-truth version pin (only `backend/pyproject.toml` is hand-edited; all other version fields derive via `make sync-versions`)

### CI/CD
- **GitHub Actions**: `ci.yml`, `coverage.yml`, `docs.yml`, `launcher-{linux,macos,windows}.yml`, `release-gate.yml`, `mutation-import.yml`
- **Pre-commit hooks**: ruff (lint + format), check-yaml/json, trailing-whitespace, end-of-file-fixer
- **Release-gate** enforcement (version pins in sync; subsystem lock-step; install.sh template freshness)

### Docs
- **MkDocs Material** with i18n (`mkdocs.yml`, `docs/pyproject.toml` carries the docs venv)
- `docs/CONCEPT.md`, `docs/ROADMAP.md`, `docs/API.md`, `docs/help/{en,de}/...`
- Generator scripts for ROADMAP archival, mkdocs nav, audit reports

### Deployment
- **Docker Compose** (dev + prod variants)
- **install.sh / install.cmd / install.ps1 / install.command** one-liners for end users
- **start.sh / stop.sh / uninstall.sh** entry-points

## Tech stack snapshot

| Layer | Stack |
|-------|-------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry |
| Frontend | React 18+, TypeScript (strict), Vite, Radix UI, @dnd-kit, Lucide, react-toastify |
| Plugins | pluginforge ^0.10.0 (PyPI) |
| Launcher | PyInstaller |
| Testing | pytest, Vitest, Playwright, mutmut, Stryker |
| Tooling | Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit |
| Docs | MkDocs Material |

## Repository layout

```
pluginforge-app-template/
├── backend/app/           # FastAPI core (main, models, routers, services, hookspecs)
├── backend/config/        # app.yaml + i18n/ (8 languages)
├── backend/tests/         # pytest suite (with test-isolation tripwires)
├── plugins/               # empty + plugins/README.md
├── frontend/src/          # React app (api, components, pages, styles)
├── e2e/                   # Playwright specs (smoke + full)
├── launcher/              # PyInstaller cross-OS launcher
├── docs/                  # MkDocs site + CONCEPT/ROADMAP/API
├── scripts/               # version sync, ROADMAP archival, audits
├── .github/workflows/     # CI/CD pipelines
└── Makefile, docker-compose*.yml, install.{sh,cmd,ps1,command}, .env.example
```

See [CUSTOMIZE.md](CUSTOMIZE.md) for the field guide on adapting each part.

## Ecosystem

| Repo | Role |
|------|------|
| [pluginforge](https://github.com/astrapi69/pluginforge) | Plugin framework (PyPI). The runtime backbone. |
| [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) | This template. Generic scaffold for new PluginForge apps. |
| [adaptive-learner](https://github.com/astrapi69/adaptive-learner) | Reference downstream app. Patterns in `.claude/rules/` evolved here. |
| [bibliogon](https://github.com/astrapi69/bibliogon) | Book-authoring app. The original skeleton was extracted from here. Acknowledged for attribution; not a runtime dependency. |

## Commands

```bash
make install              # Poetry + npm install
make dev                  # backend (8000) + frontend (5173) in parallel
make dev-bg / dev-down    # background mode
make test                 # backend pytest + frontend vitest
make test-coverage        # opt-in coverage run
make test-backend         # backend only
make test-frontend        # vitest only
make prod                 # Docker Compose (prod compose file)
make prod-down            # stop Docker
make clean                # remove build artifacts
make help                 # list all targets
```

E2E tests are NOT on the `make test` default path. Run separately:

```bash
npx playwright test --project=smoke
npx playwright test --project=full
```

## Versioning

The template follows Semantic Versioning. The current minor (`v0.x`) reflects an evolving template surface; the first feature-complete release will be `v1.0.0`. Single source of truth for the version pin is `backend/pyproject.toml`; everything else derives via `make sync-versions`.

## License

MIT — see [LICENSE](LICENSE).

## Documentation

- [CUSTOMIZE.md](CUSTOMIZE.md) — first read after cloning
- [CLAUDE.md](CLAUDE.md) — guidance for working with Claude Code on this codebase
- [docs/CONCEPT.md](docs/CONCEPT.md) — architectural concept
- [docs/help/en/](docs/help/en/) — in-app help (also served via MkDocs)
- [.claude/rules/](.claude/rules/) — development rules (architecture, coding standards, hygiene, lessons learned, quality checks, release workflow)

# Contributing to Topos

Thank you for considering a contribution. Topos is a personal
inventory tracker for physical storage - folders, boxes, shelves
and what's inside them - built as an offline-first PWA with an
optional self-hosted backend.

## Project Layout

- `backend/` - FastAPI app, SQLAlchemy models, Alembic migrations
- `frontend/` - React + TypeScript + Vite; offline-first via a
  storage seam (`src/storage/`: backend API or IndexedDB)
- `plugins/` - PluginForge plugins (ships with excel-import)
- `launcher/` - cross-platform desktop launcher (PyInstaller)
- `e2e/` - Playwright smoke + full suites
- `docs/` - concept, roadmap, configuration, session journals
- `.claude/rules/` - project rules; `architecture.md`,
  `coding-standards.md` and `tdd.md` apply to every change

## Getting Started

### Prerequisites

- Python 3.11 or newer
- Node.js 24 (runtime for Vite builds)
- bun 1.3.14 (package manager + script runner for `frontend/`
  and `e2e/`)
- Poetry (Python dependency management)
- Docker + Docker Compose v2+ (for the prod-shape flow; not
  required for `make dev`)

### Bootstrap

```bash
git clone https://github.com/astrapi69/topos.git
cd topos
make install      # Poetry (backend + launcher) + bun (frontend + e2e)
make test         # baseline; should be green before you start
make dev          # backend on :8010, frontend on :5183
```

`make help` lists every available target. The
[Makefile](Makefile) is the canonical source of truth for build
commands; do not invent new ones in PRs without adding them to
the Makefile in the same change.

### Running tests

```bash
make test              # backend + plugins + frontend (must stay green)
make test-backend      # pytest + mypy
make test-plugins      # plugin suites (run in the backend venv)
make test-frontend     # Vitest
cd e2e && npx playwright test   # E2E (needs a running app)
```

## Architecture ground rules

The long versions live in `.claude/rules/`; the short ones:

- **Four layers**: Frontend → Backend → PluginForge → Plugins.
  New features belong in a plugin unless they touch the core
  (Container/Item/Category/Action CRUD, the storage seam,
  backup/restore, the UI shell).
- **Storage seam is law**: pages and components call
  `getStorage().<entity>.<op>` - never `api.*` or `fetch()`
  directly. Both deployments (backend and offline PWA) work
  through this one seam.
- **Errors**: services throw `ToposError` subclasses, never
  `HTTPException`; routers catch nothing; the frontend surfaces
  every failure as a toast with detail. Generic "it failed"
  messages are rejected in review.
- **Both modes or neither**: a data feature that works against
  the backend must work in the offline PWA too (and its Excel/
  backup round-trip must stay lossless - there are pins that
  will fail if it does not).

## Coding Standards

- **TDD**: behaviour changes start with a failing test - run it,
  see it fail, then implement (`.claude/rules/tdd.md`). Bug
  fixes keep their reproduction test as a regression pin.
- Python: type hints always, snake_case, Pydantic v2, ruff +
  ruff-format, mypy clean.
- TypeScript: strict mode, no `any` without a comment, Radix UI
  for primitives, @dnd-kit for drag-and-drop, Lucide icons,
  react-toastify for user feedback.
- Styling: token-backed Tailwind utilities from `src/ui/classes.ts`;
  fixed-palette colours (`gray-*`, `blue-*`) are forbidden for
  chrome.
- i18n: Topos ships in 8 languages (DE, EN, ES, FR, EL, PT, TR,
  JA). New user-facing strings go into ALL catalogs
  (`backend/config/i18n/`), then `python3
  scripts/generate_i18n_catalogs.py` regenerates the bundled
  copies - a pre-commit hook blocks drift.
- E2E selectors: `data-testid` only.

## Commit Conventions

Topos uses [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` - with a
scope when it is clear (`feat(tree): ...`). One logical change
per commit, and every commit leaves `make test` green.

Install the hooks once:

```bash
cd backend && poetry run pre-commit install
```

## Pull Requests

- Branch from `develop` (`feature/{name}`, `fix/{name}`).
- Keep one concern per PR.
- `make test` green, `tsc --noEmit` clean, hooks passing.
- New UI features come with a Playwright smoke spec under
  `e2e/smoke/`.
- Reference the issue (`Closes #NN`) where one exists.

## Code of Conduct

Be respectful and constructive. This is a small project run in
spare time; patience in both directions is appreciated.

## Security

Please do not report security issues in public GitHub Issues -
see [SECURITY.md](SECURITY.md) for the private reporting channel.

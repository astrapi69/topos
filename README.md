# Topos

> Personal inventory tracker for folders, boxes, and what's inside them.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Topos is an open-source web app for cataloguing physical storage -
file folders, archive boxes, drawers - and what each one holds.
Items live in hierarchical categories; pending follow-ups live as
actions; the whole inventory is searchable, filterable, and
importable from an Excel workbook. Runs as an offline-first PWA in
the browser or as a cross-platform desktop app via PyInstaller.

Deutsche Version: [README-de.md](README-de.md).

## Features

- **Four-entity inventory** - containers (folders + boxes), items,
  hierarchical categories, follow-up actions.
- **Excel import** - drop in an `Ordner-Ordnung.xlsx` (or any
  workbook in the same three-sheet shape) and Topos materialises
  the inventory, including the ancestor-chain Category tree.
  Idempotent on container external-id, so re-importing the same
  file produces zero duplicates.
- **German -> English slug translation** at import time, with the
  original German preserved as the display name.
- **Offline-first PWA** with a Dexie read-through cache - pages
  render instantly from IndexedDB, then revalidate from the API.
- **Plugin-driven extensibility** built on
  [PluginForge](https://github.com/astrapi69/pluginforge): the
  Excel importer is itself a plugin. Future imports, exports,
  QR labels, and photo attachments will land the same way.
- **Cross-platform desktop** launcher (Linux, macOS, Windows)
  built from the same FastAPI + React codebase.

## Ecosystem

Topos is one of a family of MIT-licensed projects:

- [pluginforge](https://github.com/astrapi69/pluginforge) - the
  application-agnostic plugin framework Topos runs on
- [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) -
  the scaffold Topos was extracted from
- [adaptive-learner](https://github.com/astrapi69/adaptive-learner),
  [bibliogon](https://github.com/astrapi69/bibliogon) - sibling
  applications

## Quick start

```bash
git clone https://github.com/astrapi69/topos.git
cd topos
make install              # Poetry (backend + launcher) + npm (frontend)
make test                 # backend pytest + frontend Vitest
make dev                  # backend on :8000, frontend on :5173
```

Open <http://localhost:5173> in the browser; the dashboard opens
on an empty inventory.

To seed from an Excel workbook:

1. Open `/import` in the browser.
2. Drag-and-drop your `Ordner-Ordnung.xlsx` (or a workbook with
   the three sheets `Meine Ordner`, `Ordner Eltern`, `Boxen`).
3. Click upload.
4. The import report shows how many containers, items, actions,
   and categories landed; navigate to Containers to see the
   inventory.

For the desktop launcher (single-binary install), see
[launcher/README.md](launcher/README.md).

## Architecture

Four layers: React frontend → FastAPI backend → PluginForge →
plugins. Containers, items, categories, and actions live in the
core; everything else (imports, exports, QR labels, photo
attachments) is plugged in. The backend is the single source of
truth; the PWA's Dexie store is a read-through cache. See
[docs/CONCEPT.md](docs/CONCEPT.md) for the long version.

## Repository layout

```
topos/
├── backend/app/           FastAPI core (main, database, models, routers, services, secrets_store)
├── backend/config/        app.yaml, i18n/ (8 languages)
├── backend/migrations/    Alembic baseline
├── backend/tests/         pytest suite
├── plugins/               topos-plugin-excel-import
├── frontend/src/
│   ├── api/client.ts      Typed API client (camelCase boundary)
│   ├── components/        NavBar + AppDialog
│   ├── db/schema.ts       Dexie cache
│   ├── hooks/useTopos.ts  Stale-while-revalidate hooks
│   ├── pages/             Dashboard, ContainerList/Detail, ItemEditor, CategoryBrowse, Actions, Import, Settings
│   └── styles/global.css  Themes + variables
├── e2e/                   Playwright smoke spec
├── launcher/              Cross-OS PyInstaller launcher
├── docs/                  Concept, roadmap, configuration
└── Makefile, docker-compose.yml, install.sh, ...
```

## Status

Bootstrap stage. The seven phases of the project bootstrap (rename,
domain replacement, services, routers, Excel-import plugin,
frontend pages, docs) are complete and tested. The roadmap items
under
[docs/ROADMAP.md](docs/ROADMAP.md#next-p2---high-value-features)
are the next concrete work: tree-api port, QR labels, photo
attachments, PWA hardening, launcher binary verification.

Not production-hardened yet. Do not run on shared infrastructure
without putting the backend behind a reverse proxy and replacing
the default `secret_key` (see
[docs/configuration.md](docs/configuration.md)).

## License

MIT - see [LICENSE](LICENSE).

# Topos - concept

**Repository:** [github.com/astrapi69/topos](https://github.com/astrapi69/topos)
**Built on:** [PluginForge](https://github.com/astrapi69/pluginforge) (PyPI: pluginforge ^0.10.0)
**Sibling projects:**
[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) (the scaffold Topos was extracted from),
[adaptive-learner](https://github.com/astrapi69/adaptive-learner),
[bibliogon](https://github.com/astrapi69/bibliogon)

This document describes the architecture and the concept. For
runtime configuration see [configuration.md](configuration.md); for
the current backlog see [ROADMAP.md](ROADMAP.md).

---

## 1. Goal

Topos is a **personal inventory tracker** for physical storage:
file folders, archive boxes, drawers, anything with a number on it.
Every container holds zero or more **items** (a line of content,
e.g. "checking account statement 2025"); items live in
hierarchical **categories** (finance → bank → checking-account); a
container or item can carry pending **actions** (call the bank,
request a copy, file the receipt).

The starting dataset is a real spreadsheet: 209 file folders + 70
parent-owned folders + 166 archive boxes from one person's
home-office inventory. Topos imports that workbook once and then
becomes the long-term tool for keeping the inventory current.

Topos runs as:

1. An **offline-first PWA** in the browser.
2. A **cross-platform desktop app** (Linux, macOS, Windows) via the
   PyInstaller launcher inherited from the template.

Source is open under MIT. The user owns their data; the backend is
the single source of truth; there is no cloud-saas tier.

---

## 2. Domain model

Four entities. See [backend/app/models/](../backend/app/models/)
for the SQLAlchemy definitions.

### Container

A physical storage unit. Either a hanging-file folder or an
archive box. Has a numeric `external_id` (the number written on
the spine), a `type` (`folder` | `box`), an `owner`
(`self` | `parents` | `shared`), a free-text `label`, an optional
`description` (which can span multiple lines from the source
spreadsheet), an optional `location` (where it sits - "office",
"basement shelf 2"), and an optional `size_group` for boxes
(e.g. `"3000 bis 3099"` denotes the very-large-box range).

### Item

A single inventoried content line attached to a container.
Examples: "bank statement 2024", "tax forms 2023". An item has
`content` (the visible text), a `priority` (none / low / medium /
high / very_high), an optional slug-shaped `category_path`
(e.g. `"finance/bank/checking-account"`), and optional `notes`.
Items cascade-delete with their container.

### Category

The hierarchical taxonomy. Each row carries a slash-separated
English `path` (the canonical kebab-case slug - stable across
languages), a `parent_path` link, a leaf `name`, and a
`display_name` (the human-readable label, German by default since
the seed dataset is German). The tree is materialised on demand
via `GET /api/categories/tree`. Item-to-category coupling is
loose - items just store the slug, categories live independently
so the same path keeps working even if an item moves containers.

### Action

A pending or completed follow-up tied to an item. Examples from
the seed dataset: "review and possibly cancel", "request
statement", "check meter reading". Status is one of
`open` / `done` / `archived`; the `complete` endpoint records the
completion time. Actions cascade-delete with their item.

The deliberate non-features:

- No nesting of containers inside containers. Folders and boxes
  sit at one level; categorisation is what makes them findable.
- No per-item attachments (photos, scanned PDFs) in v1. Filed
  for a later phase.
- No tagging system beyond categories. Categories carry the same
  weight as tags would; one taxonomy is enough.

---

## 3. Architecture

Four layers, top to bottom (per `.claude/rules/architecture.md`):

1. **Frontend** - React 18 + TypeScript + Vite. Pages under
   `frontend/src/pages/`. Radix UI for accessible primitives
   (Dialog, Collapsible). No Tailwind. No editor (Topos has no
   long-form text). State is local React + Dexie cache; no global
   store.
2. **Backend** - FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2.
   Layered as routers → services → models per code-hygiene.md.
   Routers stay thin; services raise typed `ToposError` subclasses;
   a global exception handler maps to HTTP status codes.
3. **PluginForge** - External PyPI package
   (`pluginforge ^0.10.0`), based on `pluggy`. Hooks discovered
   from the `topos.plugins` entry-point group; plugin manager
   mounts each plugin's routes under `/api`. Hookspec lives at
   `backend/app/hookspecs.py`.
4. **Plugins** - Standalone Python packages under `plugins/`.
   v1 ships one: [`topos-plugin-excel-import`](../plugins/topos-plugin-excel-import/).

The frontend talks to the backend via the typed client at
`frontend/src/api/client.ts`. The client normalises snake_case
JSON to camelCase TS at the boundary, so the rest of the
frontend stays idiomatic.

### Dexie as a read-through cache

The PWA needs to render usefully even on a flaky connection. So
every page that lists entities (`useContainers`, `useItems`,
`useCategories`, `useActions`) follows the stale-while-revalidate
pattern: load cached rows from IndexedDB (instant render), then
fetch fresh from the API and swap. Mutations go through the API
directly; the cache is updated from the response.

The backend remains the source of truth. There is no offline
mutation queue, no CRDT, no two-way sync. If a request fails the
mutation fails; the UI surfaces an error. This is a deliberate
non-feature; see Section 5.

---

## 4. Excel as the bootstrap data source

The seed dataset is an `.xlsx` file with a specific three-sheet
shape (the user's personal `Ordner-Ordnung.xlsx`):

| Sheet | Owner | Type | Cols 0-6 |
|---|---|---|---|
| `Meine Ordner` | `self` | `folder` | id, label, content, priority, category-path, location, action |
| `Ordner Eltern` | `parents` | `folder` | id, label, content, priority (no location or action) |
| `Boxen` | `self` | `box` | id-or-range, label, ..., content (col 4), category-path (col 5) |

The `topos-plugin-excel-import` plugin owns the parse + import
loop. It is idempotent on `Container.external_id`; re-importing
the same workbook produces zero inserts. Items match within a
container on `(container_id, content)`; actions match on
`(item_id, text)`. Existing action status is preserved across
re-imports (a completed action stays completed even if the
source row still lists it as open).

German source labels (priority strings like "sehr hoch",
category segments like "Finanzen/Bank/Girokonto") are translated
to English slugs via two mapping tables in
`plugins/topos-plugin-excel-import/topos_excel_import/mappings.py`.
The original German is preserved in `Category.display_name` so
the UI can show the user's vocabulary even when the slug is
English.

Categories are created lazily on import: every segment in an
item's category path that doesn't yet exist gets a fresh
`Category` row, parent-to-leaf, so the tree is always fully
materialised.

---

## 5. Sync strategy: there isn't one

The backend is the single source of truth. Dexie is a read-through
cache. If multiple devices (browser + desktop launcher) want to
share state, they point at the same backend instance.

Out-of-scope by design:

- Multi-master replication / CRDT-based sync.
- Offline mutation queue that replays on reconnect.
- Per-user authentication or multi-tenant data partitioning.
- A cloud-hosted Topos service. Run your own backend.

This isn't a stance against future sync; it's a stance against
**bootstrap-phase complexity**. The user's actual workflow is one
person + one backend + one mobile browser + occasional desktop
use. CRDT machinery is a tax that this workflow doesn't pay.

---

## 6. Plugin extension points

`backend/app/hookspecs.py` currently exposes one placeholder hook:
`app_ready(app_id, app_version)`. The rest of the plugin surface
is the same as PluginForge's defaults: each plugin can mount
FastAPI routes via `get_routes()`, declare frontend UI surfaces
via `get_frontend_manifest()`, and report health via `health()`.

The `topos-plugin-excel-import` plugin demonstrates the route
pattern: it mounts `POST /api/import/excel` and is discovered via
the `topos.plugins` entry-point group.

Plugins that need their own secrets register env-var overrides at
activation time via
`app.secrets_store.register_plugin_secret_override("plugins.<name>.<key>", "TOPOS_PLUGIN_<NAME>_<KEY>")`.
The resolved value lands at the matching dotted path in the
merged config dict; see [configuration.md](configuration.md).

### Likely future plugins

These are sketches, not commitments:

- **CSV import** - sibling to the Excel importer for users with
  different source formats.
- **QR-label printer** - generate a printable sheet of QR codes
  keyed by `Container.external_id` so a phone scan jumps to the
  detail page.
- **Photo attachments** - one or more photos per container,
  scaled + stored under the data dir.
- **Voice import** - local speech-to-text for entering items
  hands-free while standing in front of a shelf.
- **Backup / restore** - periodic export of the SQLite DB +
  uploads to a chosen filesystem path or remote.

Each lands as a standalone plugin under `plugins/`. None ship in
v1.

---

## 7. Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite,
  Pydantic v2, Alembic, Poetry, pluginforge 0.10.x.
- **Frontend:** React 18, TypeScript (strict), Vite, Radix UI,
  @dnd-kit (carried from the template for future drag-reorder
  work), Lucide, react-toastify, Dexie 4.
- **Plugins:** pluginforge entry-point group `topos.plugins`.
- **Launcher:** PyInstaller-based cross-OS desktop launcher
  (`launcher/`).
- **Testing:** pytest (backend + plugins), Vitest (frontend),
  Playwright (e2e).
- **Tooling:** Poetry, npm, ruff, ESLint, Prettier, pre-commit,
  Make, Docker.

---

## 8. Out of scope

Things Topos deliberately does not do:

- AI-driven categorisation, summarisation, or any LLM features.
  Topos is a deterministic record-keeper.
- A cloud / SaaS / multi-tenant offering. Run your own
  backend.
- WYSIWYG editing. Items are short strings; notes are plain
  text.
- Mobile-native apps (iOS / Android). The PWA covers mobile.
- Auth + per-user data partitioning. Single-user.
- The TypeScript port of `astrapi69/tree-api` +
  `astrapi69/gen-tree`. Categories use a slash-separated string
  today; the tree-api port is filed for a later phase.

If any of these turn out to be load-bearing, they get reopened.
For now they are filed.

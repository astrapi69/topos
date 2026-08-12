# Changelog

All notable changes to Topos are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [0.2.0] - 2026-08-12

The offline release. v0.1.0 shipped a PWA that could show data without a
backend; this one can actually work without one - create containers,
recognise photos, import and export Excel, and run in eight languages,
all from the browser alone.

### Added

#### Excel export, and import without a backend
- `GET /api/export/excel` writes an import-compatible workbook, and the
  browser can build the same file itself - so the offline PWA exports too.
- The importer now runs client-side as well (`src/excel/`), applying the
  same match keys as the backend plugin: container by number, item by
  (container, content), action by (item, text), category by path.
- The round-trip is lossless. The sheet layout gained the columns that were
  missing for it - owner, notes, category slug, box priority, item number -
  plus a `Kategorien` sheet carrying the taxonomy verbatim, and actions now
  encode their status and dates. Columns were appended, never reordered, so
  workbooks written by older versions still import.
- Verified across runtimes: a file written by the browser imports losslessly
  in the backend plugin, and the reverse.

#### Per-container item numbers
- Items carry a user-facing number counted per container, shown as `42-3`:
  the third entry in folder 42. Assigned as "highest + 1" so deleting an
  entry never hands its number to a later one, re-assigned when an item
  moves, editable when a label already exists on paper - checked for
  uniqueness inside its container only.
- Existing rows are numbered by an Alembic migration and, independently, by
  a lazy backfill on read, so nothing stays unnumbered even where no
  migration runs (the browser).

#### Offline-first storage
- All pages go through a storage service (`getStorage()`): the backend is
  the source of truth in api mode, IndexedDB is the real store in dexie
  mode. The GitHub Pages build is now a genuine offline app rather than a
  read-only view - no demo data.

#### AI and photo intake
- Photo recognition works browser-direct where the provider allows it.
  Which providers those are was measured, not assumed: Anthropic, Google
  and Perplexity reach their vision endpoints from a browser; OpenAI's chat
  endpoint sends no CORS headers, so it stays backend-only.
- Perplexity added as a provider; AI keys can be imported from a sibling
  app's encrypted vault; the local vault asks for its passphrase lazily, on
  the first key save, instead of gating the provider list behind it.

#### Settings, navigation, languages
- Settings is organised as tabs behind a left sidebar, with the active tab
  in `?tab=`. One shared model drives the desktop sidebar and the mobile
  menu; a test pins that neither can gain a tab the other lacks.
- All eight locales are fully translated. They were byte-identical copies
  of English before, so picking Spanish showed English.
- Manual "check for updates" control in the About panel.

### Fixed
- Language switching did nothing in the deployed app: the catalogs came only
  from the backend. They ship in the build now, one lazy chunk per language.
- The offline PWA could not create a container inline, nor commit recognised
  items - both were gated on a backend they never had. Photo intake was
  unusable as a result.
- Deep links returned HTTP 404 on GitHub Pages. Every static route now gets
  its own prerendered shell, so Pages answers 200.
- The static build fired four requests per load at an API that does not
  exist there, one of them against the wrong host path entirely.
- Controls rendered in the browser's 13.33px Arial with grey system chrome
  next to 16px DM Sans text, because Tailwind's Preflight is deliberately
  off. Form controls inherit the page typeface now.
- Page content clung to the left edge on wide screens; every page column is
  centred.
- Form controls without an accessible name (the language select among them).

### Changed
- GitHub Pages deploys from `main` instead of `develop`, so the version the
  app reports matches the newest commit rather than the one before the merge.
- 37 unused packages removed: 27 TipTap/ProseMirror, plus dompurify, xstate,
  react-markdown and friends, and four text-to-speech engines in the backend
  - all inherited from the book-authoring template, none imported.
- ESLint is real now (flat config, correctness rules only) and Prettier runs
  as a pre-commit hook; both were documented but never installed.

## [0.1.0] - 2026-08-06

First public release. Topos is a personal inventory tracker for physical
storage (folders, boxes, drawers) and the items inside them. It runs as an
offline-first PWA in the browser and as a cross-platform desktop app via a
PyInstaller launcher.

### Added

#### Inventory core
- Domain model: Container, Item, Category, Action, with cascade deletes.
- CRUD services and REST routers for all four entities (FastAPI + SQLAlchemy
  2.0 + SQLite + Pydantic v2, Alembic baseline migration).
- Hierarchical category tree (`GET /api/categories/tree`), category rename
  cascade, delete cascade, and an orphan report endpoint.
- Bulk item import (`POST /api/items/bulk`) with per-row validation.
- Full-text search across containers and items (MiniSearch), wired into the
  dashboard and the navbar global search.

#### Excel import plugin
- `topos-plugin-excel-import`: imports `Ordner-Ordnung.xlsx` (or any workbook
  in the same three-sheet shape) idempotently via `POST /api/import/excel`,
  registered through the PluginForge `topos.plugins` entry-point group.

#### Photo attachments
- Container photo attachments in both modes: server-side file storage
  (upload / list / serve / delete) and offline Dexie blob storage.
- Client-side image pipeline: Canvas downscale to a full JPEG (~1568px) plus a
  thumbnail (~320px), which also strips EXIF. Camera capture and multi-file
  gallery upload; grid view with a fullscreen lightbox.

#### AI provider settings
- Browser-local AI provider configuration via `@astrapi69/ai-key-vault`
  (+`-react`, `passphrase-vault`): at-rest passphrase-encrypted local key vault
  with an in-memory unlock session, plus a backend-stored (write-only) mode.
- Vision proxy endpoint (`POST /api/ai/vision`) and provider clients
  (Anthropic / OpenAI / Google) with schema-enforced structured output.
- Custom OpenAI-compatible provider support and per-provider key deletion.
- Photo-intake page: stage box photos, run AI content recognition, commit
  recognized items to a container.

#### PWA and offline
- Installable PWA: web app manifest, full icon set (including maskable and
  Apple touch icon), and theme-color.
- Offline-first: Dexie read-through cache, static `offline.html` fallback,
  service worker with `autoUpdate`, and a version manifest for deploy
  detection.
- Install affordances: Android/desktop `beforeinstallprompt` capture surfaced
  as an inline link in Settings > About, plus a dismissable iOS Safari
  "Add to Home Screen" hint.
- Route-level code splitting with a guarded reload for stale deploys.

#### Theming and UI
- Six curated themes (Classic light/dark plus Graphite, Soft-Pop,
  High-Contrast, Ocean), driven by CSS custom properties and a Tailwind token
  bridge; theme picker in Settings, anti-flash pre-paint.
- Responsive shell: top navbar on desktop, bottom tab bar on mobile; Radix UI
  dialogs, confirmation dialogs for destructive actions, and react-toastify
  feedback across all pages.

#### Data portability
- Backup export/import (`GET /api/backup/export`, `POST /api/backup/import`)
  with merge/replace modes and foreign-key remapping, plus a TypeScript
  export/import path for offline PWA mode.
- Container QR share, an app-share QR, and a printable label sheet.

#### Desktop launcher
- Cross-OS PyInstaller launcher that bootstraps the backend, opens the
  frontend in the browser, and manages install / auto-update / uninstall.

#### Configuration and secrets
- Four-layer secret resolution: project config < user overlay <
  `~/.config/topos/secrets.yaml` (gitignored, auto-templated at 0600) <
  env vars; plugins register their own secret overrides. Settings page exposes
  the resolved secret source.

#### Deploy and SEO
- GitHub Pages deploy workflow with a base-aware build and an SPA 404
  fallback; SEO meta tags, structured data, `robots.txt`, `sitemap.xml`, and
  an Open Graph image.

#### Internationalisation
- Eight language catalogs (DE, EN, ES, FR, EL, PT, TR, JA); DE and EN authored,
  the other six carry EN placeholders. A parity test enforces identical keys
  across all catalogs.

### Notes
- Licensing infrastructure exists but is dormant (`LICENSING_ENABLED = False`);
  all plugins are free (MIT).

[0.1.0]: https://github.com/astrapi69/topos/releases/tag/v0.1.0

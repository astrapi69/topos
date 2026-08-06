# Changelog

All notable changes to Topos are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

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

# Topos roadmap

## Done

### Phase 1 - bootstrap

- [x] Repository bootstrapped from
      [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)
- [x] Global rename: `myapp` -> `topos`, env vars `TOPOS_*`
- [x] Topos domain (Container, Item, Category, Action) replaces
      the template's EXAMPLE-DOMAIN (~250 files deleted)
- [x] CRUD services + 26 endpoints across four routers
- [x] Excel-import plugin (`topos-plugin-excel-import`):
      parses `Ordner-Ordnung.xlsx`, idempotent on `external_id`,
      ancestor-chain Category creation, German -> English slug
      translation, ImportReport response
- [x] Frontend pages: Dashboard, ContainerList, ContainerDetail,
      ItemEditor, CategoryBrowse, Actions, Import, Settings.
      Dexie read-through cache, stale-while-revalidate hooks
- [x] i18n: DE + EN fully populated, 6 other catalogs as
      EN placeholders
- [x] Tests: 322 backend + 27 plugin + 90 frontend Vitest +
      1 Playwright spec
- [x] Secrets layer: `~/.config/topos/secrets.yaml` with
      auto-templated 0o600, env-override map extendable by plugins
      via `register_plugin_secret_override`

## Next (P2 - high-value features)

- [ ] **TypeScript port of `astrapi69/tree-api` +
      `astrapi69/gen-tree`**. Replace the string-based
      `Item.category_path` with a proper Tree structure on the
      frontend. Tracking handover doc:
      `Tree-Portierung-Uebergabe.md` (separate session).
- [ ] **QR-label-print plugin**. Generate a printable PDF with one
      QR code per container, keyed by `Container.external_id`.
      Scan from a phone -> jump to `/containers/{id}`.
- [ ] **Photo attachments**. Multi-image upload per container,
      thumbnails on ContainerDetail, full-size view, EXIF strip,
      stored under the data dir.
- [ ] **PWA installability hardening**. Manifest icons, install
      prompt, offline shell, service-worker precache audit.
- [ ] **Desktop launcher build pipeline verified**. Per-OS GitHub
      Actions builds for Linux / macOS / Windows currently exist
      from the template; verify they still produce working
      artifacts for Topos and ship a v0.1.0 release.

## Later (P3 - quality + reach)

- [ ] i18n: translate the six placeholder catalogs (EL, ES, FR,
      JA, PT, TR) into their target languages
- [ ] CSV-import plugin (sibling to Excel)
- [ ] Backup / restore plugin (export full DB + uploads to a
      file or remote)
- [ ] Search: integrate MiniSearch for client-side fuzzy
      full-text search; the current backend `/items/search` is
      ilike-substring only
- [ ] Voice-input plugin for hands-free item entry (mobile-first,
      basement / shelf-side use case)

## Speculative (P5 - nice-to-have, no concrete trigger)

- [ ] Family-shared mode: multi-user backend behind auth
- [ ] Export plugin (back to xlsx for offline backup)
- [ ] Calendar integration for action `due_date` reminders

## Out of scope

These are deliberate non-features per
[CONCEPT.md](CONCEPT.md#8-out-of-scope):

- AI / LLM features
- Cloud / SaaS / multi-tenant offering
- WYSIWYG editing or long-form text
- Native mobile apps (iOS / Android)
- CRDT-based multi-master sync

If a load-bearing reason to revisit one of these appears, file it
here as a P2 with the concrete trigger.

# Topos roadmap

## Done

### Phase 1 - bootstrap

- [x] Repository bootstrapped from
      [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)
- [x] Global rename: template placeholder -> topos, env vars `TOPOS_*`
- [x] Topos domain (Container, Item, Category, Action) replaces
      the template's example domain (~250 files deleted)
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

- [x] **Category rename cascade + orphan report** (was: "real
      relation instead of a slash-joined string"). The as-is audit
      (issue #11) showed no tree structure is needed - the hierarchy
      already lives in the `Category` table and every
      `Item.category_path` consumer needs only string operations.
      Shipped instead: rename/move cascade (prefix rewrite over
      subcategories + item paths), delete cascade (items nulled, not
      deleted), `GET /api/categories/orphans` + Settings UI for
      reassign/remove. No schema migration. Remaining non-urgent
      findings (dead Dexie `categoryPath` index, backend-vs-client
      search-semantics divergence) stay documented in #11.
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

- [ ] **Adopt `@astrapi69/tree-kit` for the category tree**. The
      TypeScript port of `astrapi69/tree-api` + `astrapi69/gen-tree`
      is done and published (0.1.0, MIT, zero dependencies);
      `adaptive-learner` consumes it. Deferred here deliberately:
      `frontend/src/utils/categoryTree.ts` already builds pure data
      through an O(n) `Map` index and carries none of the defects
      the port fixed, and `CategoryNode` is the response type of
      `GET /api/categories/tree`, so switching means a mapping
      layer on the online and the offline path both. The trade
      turns favourable with a second tree use case, or once
      breadcrumb / depth logic makes `TreeCursor` pay for itself -
      `CategoryBrowse` currently threads `depth` through as a prop.
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

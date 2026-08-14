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

### Phase 2 - features

- [x] **Category rename cascade + orphan report** (issue #11):
      rename/move cascade (prefix rewrite over subcategories + item
      paths), delete cascade (items nulled, not deleted),
      `GET /api/categories/orphans` + Settings reassign/remove UI. No
      schema migration. Non-urgent leftovers documented in #11.
- [x] **Client-side search (MiniSearch)**: fuzzy full-text over the
      four entities, incremental index updates, global search +
      Dashboard search (`search/buildIndex.ts`, `GlobalSearch.tsx`,
      `useSearch.ts`). No longer reliant on the backend ilike-substring
      `/items/search`.
- [x] **Data export/import** (Settings, core feature - not a plugin):
      `.topos.json` backup. Backend path (`GET`/`POST /api/backup/*`,
      one transaction, foreign-key remapping) + offline Dexie path,
      auto-selected by `isBackendAvailable()`; merge/replace with a
      typed-confirm on replace.
- [x] **Multi-theme system**: 6 curated themes (light, dark, graphite,
      soft-pop, high-contrast, ocean) on `data-app-theme` + theme
      picker, token-parity test, pre-paint anti-flash.
- [x] **AI provider settings** via `@astrapi69/ai-key-vault(-react)`:
      passphrase-encrypted local key vault (offline PWA) + backend-gated
      providers; photo-intake box-content recognition.
- [x] **PWA auto-update**: `@astrapi69/pwa-update` + `version.json`
      build manifest + `registerType: autoUpdate` (stale GitHub-Pages
      deploys self-heal); base-path-aware same-origin API URLs.
- [x] **About section** in Settings: version / build-hash / build-date
      (VersionCard), MIT license, source + report-issue links, donation
      channels (Liberapay / GitHub Sponsors / Ko-fi).
- [x] **feature-strategy gates**: `@astrapi69/feature-strategy` for the
      backend-required capabilities (excel-import, category-edit).
- [x] **QR codes + printable container labels** (core feature - not a
      plugin). Ported `QrCodeModal` (qrcode@1.5.4). ContainerDetail QR
      share, ContainerList label sheet (select N -> print HTML grid via
      hidden-iframe `window.print()`, save-as-PDF or Avery), About-section
      app-share QR. URLs base-aware (respect the deployment origin).
- [x] **Photo attachments**. Multi-image per container: camera + gallery
      upload, thumbnail grid on ContainerDetail, lightbox (prev/next/zoom),
      per-photo delete. Client-side Canvas downscale (full + thumb, EXIF
      stripped). Dual-mode: backend files under `<upload_dir>/containers/{id}/`
      (new endpoints + ContainerPhoto model) / offline Dexie blobs.
- [x] **bun as package manager** (frontend + e2e). bun 1.3.14 installs
      and runs scripts; Node 24 stays the runtime (Vite, Vitest, Workbox,
      Playwright). `bun.lock` replaces `package-lock.json` in both
      workspaces, Docker and the dev compose moved in the same commit.
      Resolution parity 781 = 781 against the deleted lock; the build is
      byte-identical in both modes.
- [x] **PWA installability hardening**. Precache trimmed from 2.84 MB
      over 79 entries to 1.62 MB over 67: the lazy exceljs chunk (908 KB)
      moved to a CacheFirst runtime rule, 340 KB of unreferenced icons
      deleted, og-image and the install screenshots excluded. Manifest
      gained `id`, screenshots for both form factors (captured from the
      real build by `e2e/tools/capture-manifest-screenshots.mjs`),
      shortcuts, maskable-192, and `orientation: any`. The install prompt
      moved out of Settings > About into an app-level dismissable banner,
      so the platforms that fire `beforeinstallprompt` get the same
      affordance iOS already had. Earlier in v0.2.0: prerendered static
      routes (deep links answer 200), no dead API requests per load,
      autoUpdate self-heal.
- [x] **Desktop launcher build pipeline verified**. All three per-OS
      workflows run green and attach their artifacts; checksums, file
      types and the macOS CFBundleVersion verified against the v0.2.0
      release. `topos-launcher --version` gives the binaries a headless
      path, and the release template now matches the assets the
      workflows actually attach. Starting them on macOS / Windows
      hardware is tracked separately below.
- [x] **`@astrapi69/tree-kit` adopted** (2026-08-12). The deferral
      condition ("a second tree use case") arrived: the inventory tree
      view (app root -> type/owner groups -> containers -> items) on the
      Containers page, plus the category tree builder now delegating its
      linking to the kit. `utils/categoryTree.ts` keeps only the
      Topos-specific parts (orphan tolerance, the `CategoryNode` API
      shape); `tree/inventoryTree.ts` owns group derivation, subtree item
      counts and workbook ordering.
- [x] **Container nesting + tree move** (2026-08-14). Containers nest
      physically (folder in shelf, box in cabinet): `parent_container_id`
      FK with ON DELETE SET NULL (deleting a shelf detaches, never
      deletes), cycle guards on every write path (API service, Dexie,
      both Excel importers), backup import remaps parent references,
      Excel carries an appended "Eltern-Nr." column keyed on the
      parent's external number. The tree renders the nesting and moves
      things: drag-and-drop (@dnd-kit) plus a "Verschieben nach..."
      menu as the touch/a11y surface, both over one canDrop/applyMove
      rule set. tree-kit stayed untouched by design - a move is a
      flat-row update, the tree is a projection.

## Next (P2 - high-value features)

No open P2 items. The two that stood here closed on 2026-08-12; the
launcher's remaining half is a hardware gate, see below.

## Later (P3 - quality + reach)

- [ ] CSV-import plugin (sibling to Excel)
- [ ] Voice-input plugin for hands-free item entry (mobile-first,
      basement / shelf-side use case)

## Speculative (P5 - nice-to-have, no concrete trigger)

- [ ] Family-shared mode: multi-user backend behind auth
- [ ] Calendar integration for action `due_date` reminders

## Blocked / Hardware

- [ ] **Launcher start on macOS and Windows hardware**. The build side
      is done (see Done above). What is left cannot be checked from
      Linux or from CI: does the .exe get past SmartScreen, does the
      unsigned .app get past Gatekeeper, does either reach the Docker
      check. Needs someone on each OS. Narrowed 2026-08-13: every build
      workflow now exec-smokes its artifact (`--version`), so the
      binaries provably START on real macOS and Windows runners - what
      remains is only the quarantine/signing UX (SmartScreen,
      Gatekeeper) and the Docker path, which runners cannot answer.
- [ ] **Native-speaker review of the six translated catalogs** (ES, FR,
      PT, TR, EL, JA). All 458 keys are translated and placeholder-parity
      is enforced by `scripts/apply_translation.py`; what is missing is a
      human per language. Not a code task.

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

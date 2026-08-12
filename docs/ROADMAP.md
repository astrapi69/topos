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

## Next (P2 - high-value features)

- [ ] **PWA installability hardening**. Manifest icons, install
      prompt, offline shell, service-worker precache audit.
      v0.2.0 did part of it: static routes are prerendered so deep
      links answer 200, the build stopped firing four dead API
      requests per load, and the SW self-heals on deploy
      (autoUpdate). The precache audit and the icon/install-prompt
      review are still open.
- [ ] **Desktop launcher: hardware start unverified**. The CI half
      is done: all three per-OS workflows have run green (7 runs
      each, most recently on the v0.2.0 tag), the artifacts are
      attached to the release, all three SHA256 checksums verify,
      the file types match their platforms, and the macOS
      Info.plist carries the right CFBundleVersion. The Linux
      binary starts and reports its own version.
      What is left needs the actual operating systems: does the
      .exe get past SmartScreen, does the unsigned .app get past
      Gatekeeper, does either reach the Docker check. Nobody has
      run them on macOS or Windows hardware. Also open: no
      workflow executes the artifact it just built - now possible
      via `topos-launcher --version`, tracked separately.

## Later (P3 - quality + reach)

- [ ] CSV-import plugin (sibling to Excel)
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

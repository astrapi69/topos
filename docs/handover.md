# Topos handover - bootstrap complete

Last update: 2026-05-22
HEAD: `df61224` (chore: final sanity sweep, all checks green)

The eight-phase project bootstrap is complete. This document is the
hand-off to the next session. Read it once, then start from
[ROADMAP.md](ROADMAP.md).

---

## 1. What Topos is

Personal inventory tracker for physical storage (file folders,
archive boxes, drawers) and what's inside them. Four entities:
**Container**, **Item**, **Category**, **Action**. Runs as an
offline-first PWA in the browser and as a cross-platform
desktop app via a PyInstaller launcher. Backend is the single
source of truth; Dexie is a read-through cache. MIT-licensed,
single-user, no SaaS tier.

Long version: [CONCEPT.md](CONCEPT.md).

---

## 2. Bootstrap state

```
df61224 chore: final sanity sweep, all checks green                      <- Phase 8
348b10d docs: rewrite README, CONCEPT, and ROADMAP for topos             <- Phase 7
c302415 refactor: remove dead _secrets_managed_externally helper + test  (housekeeping)
185852f test(secrets): unit + integration coverage; i18n keys; docs      (secrets, 3 of 3)
bee22fc feat(settings): expose secret_key source label in Settings       (secrets, 2 of 3)
c127a02 feat(backend): secrets.yaml loader + env-override layer          (secrets, 1 of 3)
262cb64 feat(frontend): scaffold topos pages                              <- Phase 6
ab9d70c feat(plugin): add excel-import plugin                             <- Phase 5
03d4f3b feat(backend): add CRUD services and routers                      <- Phase 4
3c01a29 feat(backend): replace example domain with topos domain           <- Phase 3
1e50ef0 refactor: rename myapp placeholder to topos across the tree       <- Phase 2
43b55e9 docs: add bootstrap prompt                                        (kickoff)
57d8f6f Initial commit                                                    <- Phase 1
```

### Test baseline (verify before starting any work)

```bash
cd backend && unset VIRTUAL_ENV POETRY_ACTIVE && PYTHONPATH=. poetry run pytest --no-cov -q tests/
# Expect: 319 passed, 1 skipped

cd plugins/topos-plugin-excel-import && PYTHONPATH=/home/astrapi69/dev/git/hub/astrapi69/topos/backend \
    /home/astrapi69/dev/git/hub/astrapi69/topos/backend/.venv/bin/pytest -q tests/
# Expect: 27 passed

cd frontend && npm run test
# Expect: 90 passed across 18 files

cd frontend && npx tsc --noEmit
# Expect: clean (empty output)

cd frontend && npm run build
# Expect: 1811 modules, PWA precache ~880 KiB

# Optional: Playwright e2e (auto-starts backend + frontend)
cd e2e && npx playwright test
# Expect: 1 passed (import-roundtrip)
```

If any of these fail, stop and investigate before working on
anything else. The baseline was green at `df61224`.

---

## 3. Codebase map (where things live)

### Backend (`backend/app/`)

- `main.py` - slim FastAPI shell (~270 LOC). Lifespan wires
  secrets template + permission warn + DB init + plugin
  discovery.
- `models/` - one file per entity (container, item, category,
  action) + `__init__.py` re-exports.
- `schemas/` - one Pydantic module per entity (Create / Update /
  Read shapes) + `category.py` also exports `CategoryNode` for
  the tree endpoint.
- `routers/` - kept: settings, plugin_install, licenses (template
  infrastructure). Added in Phase 4: containers, items,
  categories, actions.
- `services/` - one plain-function module per entity. Routers
  delegate; services raise `ToposError` subclasses.
- `secrets_store.py` - env-override map, plugin-secret
  registration, template generation, permission warning.
- `licensing.py` - HMAC license validator (dormant,
  `LICENSING_ENABLED = False`).
- `paths.py`, `config_overlay.py`, `data_dir_migration.py` -
  filesystem-isolation infrastructure.
- `middleware/body_size_limit.py` - 500 MiB default cap.
- `hookspecs.py` - single placeholder `app_ready` hookspec.

### Plugin (`plugins/topos-plugin-excel-import/`)

Only plugin in the tree. Mounts `POST /api/import/excel`.
Parses `Ordner-Ordnung.xlsx` three-sheet shape (Meine Ordner /
Ordner Eltern / Boxen). Idempotent on `Container.external_id`;
re-import produces 0 inserts. Action statuses survive re-import.

### Frontend (`frontend/src/`)

- `api/client.ts` - 26-endpoint typed surface, snake_case <->
  camelCase at the boundary.
- `db/schema.ts` - Dexie tables for the four entities.
- `hooks/useTopos.ts` - stale-while-revalidate hooks
  (`useContainers`, `useItems(filters)`, `useCategories`,
  `useActions(filters)`, `useContainer(id)`) + `refreshXxx`
  helpers + `refreshAll`. No `dexie-react-hooks` dependency;
  reactivity comes from explicit `refresh()` callbacks.
- `pages/` - eight pages: Dashboard, ContainerList,
  ContainerDetail, ItemEditor, CategoryBrowse (Radix
  Collapsible tree), Actions (optimistic mark-done), Import
  (drag-and-drop xlsx + report card), Settings (language /
  theme / cache reset / secret-source card).
- `components/NavBar.tsx` + `AppDialog.tsx` - only two
  components survived the Phase 3 prune.
- `types/topos.ts` - TS mirrors of the four entities.

### Tests

- `backend/tests/models/` - 13 unit tests
- `backend/tests/routers/` - 22 integration tests
- `backend/tests/test_secrets_store.py` + `test_settings_secret_source.py` - 21 tests
- Other backend tests: config, licensing, plugin_install, i18n
  parity, settings_api, body_size_limit, data_dir_migration,
  yaml_io, etc.
- `plugins/topos-plugin-excel-import/tests/` - 27 tests
  (mappings, parser, importer, route)
- `frontend/src/pages/*.test.tsx` - one smoke test per page
- `frontend/src/api/client.test.ts` - snake/camel pinning
- `e2e/tests/import-roundtrip.spec.ts` - the one Playwright
  spec (Dashboard -> Import -> ContainerList -> ContainerDetail)

### Docs (`docs/`)

- `CONCEPT.md` - 8-section concept doc
- `ROADMAP.md` - prioritised (Next P2 / Later P3 / Speculative P5
  / Out-of-scope)
- `configuration.md` - four-layer config chain, secrets.yaml
  format, plugin secret extension, production warning
- `prompts/Topos-Bootstrap-Prompt.md` - frozen historical
  artifact (do not edit)
- `handover.md` - this file

---

## 4. Environment gotchas (likely to bite the new session)

1. **`VIRTUAL_ENV=/usr` poisons poetry.** Some shells set this
   automatically. Always unset before `poetry install` /
   `poetry run`:
   ```bash
   unset VIRTUAL_ENV POETRY_ACTIVE
   ```
   Without it, poetry treats `/usr` as the venv and fails on
   PEP 668 (externally-managed Python on Debian/Ubuntu).

2. **In-project venvs are configured per subsystem.**
   `backend/poetry.toml` and `launcher/poetry.toml` set
   `virtualenvs.in-project = true`. Poetry creates
   `.venv/` inside each. Plugins do too once `poetry install` runs.

3. **Plugin tests run inside the backend venv**, not the
   plugin's own venv. The path-dep in
   `backend/pyproject.toml` installs the plugin into the
   backend's `.venv`. Run plugin tests via the backend venv's
   pytest binary (see test-baseline commands above).

4. **`poetry lock` on the plugin must accompany any pyproject
   change.** The `plugin-lock-paired-with-pyproject`
   pre-commit hook blocks the commit otherwise. Recipe:
   ```bash
   cd plugins/topos-plugin-excel-import && poetry lock
   git add plugins/topos-plugin-excel-import/poetry.lock
   ```

5. **Pre-commit reformats files mid-commit.** If a commit
   shows pre-commit hooks passing but `git log` doesn't show
   the commit, files were auto-fixed and the commit aborted.
   Re-stage and retry.

6. **`MYAPP_TEST=1` is now `TOPOS_TEST=1`.** Phase 2 renamed
   the placeholder. The test conftest sets `TOPOS_TEST=1`
   BEFORE any `app.*` import so the in-memory SQLite + tmp
   data dir activate correctly.

---

## 5. Hard constraints to preserve

These are decisions, not preferences. If you find a reason to
revisit, STOP and ask the user.

- **No AI features in Topos.** Phase 3 explicitly deleted the
  entire `app/ai/` module, voice store, audiobook
  infrastructure. Do not reintroduce them.
- **No new npm dependencies.** Work with what
  `frontend/package.json` already has (Radix UI, dnd-kit,
  Lucide, react-toastify, Dexie). The plan once called for
  `dexie-react-hooks`; the bootstrap declined it.
- **Backend is the single source of truth.** Dexie is
  read-through cache only. No offline mutation queue, no CRDT.
- **All German content uses real umlauts** (ä ö ü ß). The
  i18n DE catalog is the reference.
- **No em-dashes** (U+2014) in Topos-authored code, docs,
  commits. Use hyphens (-) or commas. `.claude/rules/*.md`,
  `Topos-Bootstrap-Prompt.md`, and the operational permission
  allowlist are deliberate exclusions.
- **Routers stay thin.** Services raise `ToposError`
  subclasses; routers catch nothing; the global exception
  handler in `main.py` maps domain errors to HTTP. Same
  pattern as the rest of the project.
- **Path access via helpers, never CWD-relative.**
  `app.paths.get_upload_dir()`, `get_data_dir()`, etc.
  `Path("uploads")` is forbidden.

---

## 6. Open follow-ups

See [ROADMAP.md](ROADMAP.md) for the full list. P2 items the
next session can pick up:

- **TypeScript port of `astrapi69/tree-api` +
  `astrapi69/gen-tree`**. Replace string-based
  `Item.category_path` with a proper Tree on the frontend.
  Separate handover doc exists (`Tree-Portierung-Uebergabe.md`)
  for that session.
- **QR-label-print plugin.** Generate a printable PDF, one QR
  per container, keyed by `Container.external_id`.
- **Photo attachments.** Multi-image upload per container.
- **PWA installability hardening.** Manifest icons, install
  prompt, service-worker precache audit.
- **Desktop launcher build pipeline verification.** Confirm
  per-OS GitHub Actions still build the launcher for Topos.

Operational follow-ups outside the ROADMAP:

- **`gh repo edit`** for the GitHub About description +
  topics. Command is in the Phase 7 commit message
  (`348b10d`).
- **Real `Ordner-Ordnung.xlsx`** goes into `data/seed/`
  (gitignored if it contains personal data). The bootstrap
  used a synthetic 6-row fixture.
- **Per-plugin `test-plugin-*` and `mutmut-*` targets** in
  `.PHONY` referring to deleted template plugins are dead but
  harmless. A future cleanup commit can prune them.

---

## 7. Lessons-learned that mattered during the bootstrap

These bit during Phases 1-8 specifically and are likely to
recur:

- **YAML duplicate keys.** `topos.container.type` collided
  with the nested `topos.container.type.{folder, box}` map;
  caught by the `check-yaml` pre-commit hook. Fix was to
  rename the leaf key to `type_label`. New i18n sub-trees
  need to avoid the same shape.
- **Theme-token completeness audit.** Every `var(--token,
  #fallback)` callsite must be defined in every palette x
  mode. Phase 6 deliberately used literal hex colors in the
  new pages to stay out of this gate; if you start using CSS
  variables in the new pages, define the tokens in every
  palette block in `frontend/src/styles/global.css`.
- **`make test` vs per-plugin CI install paths diverge.** A
  shared-dep pin bump in every plugin's pyproject must be
  paired with `poetry lock` in each plugin directory. The
  pre-commit hook catches it.
- **`fastapi.status` shadows the `status` query parameter on
  the Actions router.** That's why
  `app/routers/actions.py` imports without `status` and uses
  literal status codes at the decorators.
- **Alembic + new column on existing table.** Delete
  `backend/myapp.db` (no, `backend/topos.db` - if it ever
  exists; the bootstrap runs against an in-memory test DB) on
  schema changes to avoid the `duplicate column` ALTER TABLE
  trip.

More incident write-ups in `.claude/rules/lessons-learned.md`
(template-lineage; treat as reference, not as Topos-specific).

---

## 8. How to start the new session

1. Read this file plus [CLAUDE.md](../CLAUDE.md) (project
   conventions) and [ROADMAP.md](ROADMAP.md) (priorities).
2. Run the test baseline (section 2 above).
3. Confirm `git log --oneline -10` matches the bootstrap
   commit chain.
4. Ask the user what to work on. The likely first pick is one
   of the P2 ROADMAP items.

The prompt at [`.claude/prompts/next-session.md`](../.claude/prompts/next-session.md)
is the paste-once kickoff for the new Claude Code session.

# Known pitfalls and patterns

These rules come from real development and solve problems that would otherwise come back over and over.

## React 18 dev-mode double-effect-mount strands `mockImplementationOnce`

React 18 in development mode (Strict Mode and/or its testing-library equivalent) deliberately mounts components twice and runs effects twice to surface non-idempotent setup. Combined with happy-dom + Vitest, the result is that a `useEffect` calling an API mock fires twice on the first render.

If the test sets `mockImplementationOnce(returnValue)` per test, the FIRST useEffect call consumes the implementation and the SECOND call falls through to the default `vi.fn()` (which returns `undefined`) — the component then sees the default empty state and the test fails on a stale assertion.

Fixes:
- **Use `mockImplementation(...)` (no `Once`).** The implementation persists across both effect mounts. Per-test `afterEach { mock.mockClear() }` (NOT `mockReset`) keeps the implementation alive across test boundaries while still resetting call history.
- **Set a default implementation in the `vi.mock` factory itself**, e.g. `getPlugin: vi.fn(async () => ({ settings: {} }))`. Tests that don't care about the response can rely on the default; tests that do override per-test via `mockImplementation`. `mockClear` (not `mockReset`) preserves the factory default between tests.

The `mockClear` vs `mockReset` distinction matters specifically because of the factory-default pattern: `mockReset` strips the factory's implementation and the next test starts with a vanilla `vi.fn()` returning undefined, which crashes the next render's `useEffect` chain with `Cannot read properties of undefined (reading 'then')`.

## XHR mocks need a function constructor, not an arrow

`vi.stubGlobal("XMLHttpRequest", vi.fn(() => fakeXhr))` fails at runtime with `TypeError: () => fakeXhr is not a constructor`. Arrow functions cannot be invoked with `new`.

The simple fix: stub with a regular function expression, which JS allows as a constructor: `vi.stubGlobal("XMLHttpRequest", function () { return fakeXhr; })`. The `return` of an explicit object from a constructor-called function replaces the implicit `this` instance, which is exactly what we want here — the test's pre-built `fakeXhr` object becomes the result of `new XMLHttpRequest()`.

Generalizes to any global that callers invoke with `new` (`WebSocket`, `Worker`, etc.). Stubbing such globals with arrow functions silently breaks; stubbing with a regular function or a class works.

## Alembic `fileConfig` silences every existing logger

`migrations/env.py` is generated from Alembic's template, which calls `fileConfig(config.config_file_name)` unconditionally. Two side effects burn time on the day your INFO logs stop appearing:

1. **`disable_existing_loggers=True` is the default.** Every `logging.Logger` created BEFORE `init_db()` (in our app: at least `app.main`'s module-level logger) is disabled. Subsequent `logger.info(...)` calls drop to the floor.
2. **The root logger level is reset** to whatever `[logger_root] level = ...` says in `alembic.ini` (`WARNING` in this repo). So even fresh loggers created after the call inherit the lower level.

**Symptom**: you see `Starting Topos` (logged before `init_db()`), then alembic's own setup messages, then your subsequent INFO lines silently disappear. Plugin loading still WORKS — routes mount, the app responds — but the audit trail is dark. Burned several debugging hours on the v0.30.0+ medium-import session by treating "no plugin loading log = plugin not loading" as a true causal link.

**Fix**: in `migrations/env.py`, gate the `fileConfig` call so it only fires when the FastAPI app has not already configured logging:

```python
import logging
from logging.config import fileConfig
...
if config.config_file_name is not None and not logging.getLogger().handlers:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
```

The standalone `alembic` CLI invokes env.py before any handler is attached (`logging.getLogger().handlers` is empty), so the guard preserves the documented CLI behaviour. Embedded use through `init_db()` runs under the FastAPI/uvicorn handler stack and skips the call.

**Generalises to**: any library that ships an env.py-style hook calling `fileConfig`/`dictConfig` at import time. Wrap the call in a "have handlers already?" check whenever the same module is imported in two contexts (CLI vs. embedded).

## Plugin settings YAML lives in `backend/config/plugins/`, not in the plugin's own directory

PluginForge reads each plugin's settings from the backend-wide `config_dir`, configured in `app.yaml` as `plugins.config_dir: config/plugins`. So the canonical path for a plugin's settings file is:

```
backend/config/plugins/{plugin_slug}.yaml
```

NOT `plugins/topos-plugin-{slug}/config/{slug}.yaml`. The latter is fine for shipping the file inside the plugin's distributable ZIP, but at runtime PluginForge looks ONLY in the backend's config_dir.

**Symptom**: the plugin loads and activates, but `self._settings = self.config.get("settings", {})` returns an empty dict. User-visible settings silently fall back to in-code defaults; the YAML you wrote is never read. The startup log shows it as a single DEBUG line:

```
DEBUG  pluginforge.config: Config file not found, using empty defaults:
       backend/config/plugins/{slug}.yaml
```

That line has appeared in the wild for one shipped-without-defaults plugin (`medium-import` v1) and would have for any future plugin that follows the same wrong-place template.

**Mitigation**: when scaffolding a new plugin, drop the settings YAML directly into `backend/config/plugins/`. Mirror it inside the plugin's own `config/` only if the plugin's ZIP target needs it.

## Commit ordering for breaking-change dependency upgrades

- Pin the version bump BEFORE migrating call sites when the new code uses imports that only exist in the new release. Backward-compatible exports in the new version (e.g. v0.8.0 keeping `compile_book` and `OUTPUT_FILE` for one cycle) keep the intermediate state green. Doing it the other way - migrate first, bump pin last - leaves the migration commit red against the still-installed old version and breaks the "each commit green individually" rule.
- Path-installed plugins do not auto-refresh when their `pyproject.toml` changes. After bumping a transitive dependency in a plugin (e.g. `manuscripta` in `plugins/topos-plugin-export/pyproject.toml`), run `poetry lock` AND `poetry install` in the BACKEND directory too - the backend's `poetry.lock` caches the resolved deps of the plugin's old pin until you regenerate.

## Atomic commits are bounded by "green individually", not "one thing"

- The "atomic commit" rule is "each commit is the smallest reversible unit that leaves the tree green", not "each commit does one conceptual thing". When splitting a change creates a broken intermediate state - e.g. the source change deletes a function the existing tests still import - the split is wrong. Combine the pieces into one commit.
- Concrete example: a refactor that renames an exported helper. The source edit and the test edit MUST land together; otherwise either the source commit fails because tests still import the old name, or the test commit fails because the new name does not exist yet. Splitting along conceptual lines ("source change" / "test update") here produces a commit series that cannot bisect cleanly.
- Conceptual split is a goal; green-individually is a hard constraint. When they conflict, the constraint wins.

## CI vs local environment drift

Two patterns cause "passes locally, fails in CI" in Poetry-managed projects:

1. `poetry install` does not remove dependencies that vanished from pyproject.toml. Stale `.dist-info` directories in long-tenured local venvs keep importing modules that the lockfile no longer references. CI starts fresh and immediately fails. Mitigation: run `poetry install --sync` periodically, especially before assuming "local green = CI green".

2. Path-dependency declarations in pyproject.toml must include every plugin or sub-package whose code is exercised by tests. Plugin discovery via `importlib.metadata.entry_points()` only sees what's actually installed, not what exists on disk. When creating a new plugin, the path-dep declaration in backend/pyproject.toml is mandatory, not optional.

Detection: if local tests pass but CI fails on routes returning 404, suspect missing path-deps before suspecting code bugs.

## Doc files: existence is not discoverability

- When you add a new help page under `docs/help/{lang}/`, verify it appears in `docs/help/_meta.yaml`. The MkDocs nav generator (`scripts/generate_mkdocs_nav.py`) reads that file as the single source of truth; pages not listed there are unreachable from the side nav even though direct URLs and in-text links still work. We hit this with `ai.md` and `developers/plugins.md` - both had been merged for several releases but never showed up in the in-app help panel or the public docs site nav.
- Rule: file existence is not user discoverability. After creating a new help page, the same commit (or a paired one) must add the entry to `_meta.yaml` with a sensible icon and the appropriate placement among siblings.

## Doc values: read from code, not from memory

- Any specific number, threshold, default value, dropdown range, or feature flag mentioned in the docs MUST come from the code or config that defines it (`backend/config/app.yaml`, `backend/config/i18n/*.yaml`, the schema, the source of the relevant function), not from memory or approximation.
- If a value isn't easily findable in code, that is a signal to flag the question, not to guess. Wrong defaults in user docs erode trust faster than missing docs do.
- Example: trash auto-delete default came from `backend/config/app.yaml.example` (`trash_auto_delete_days: 90`); the configurable range came from the `trash_days_*` keys in `backend/config/i18n/*.yaml`. Both are single sources of truth that the docs cite without duplicating.

## Alembic migration + fresh test DB

- For every new Alembic migration that touches `books` (or another core table) via `ALTER TABLE`: the file `backend/topos.db` MUST be deleted before the next `make test`. Otherwise you get `sqlite3.OperationalError: duplicate column name: ...`.
- Reason: `backend/tests/conftest.py` calls `Base.metadata.create_all(engine)` before every test and creates the tables with the NEW schema. At the same time the on-disk DB still has `alembic_version` pinned to the old revision. `TestClient(app)` triggers the lifespan `init_db()`, which runs `upgrade head` when tables + `alembic_version` both exist - which tries to add the new column via ALTER TABLE a second time and crashes.
- Permanent fix: `rm backend/topos.db` after `git pull` with a new migration, then `make test`. `init_db()` now sees no tables, runs `create_all` + `stamp head`, and subsequent test runs pass because `alembic_version` is already at the new head.
- The clean solution would be a real in-memory test DB setup (e.g. via a `TOPOS_TEST=1` env var) that skips `init_db()` in test mode - does not exist yet.

## Docs are specification, not a wish list

- If a feature is in the help, it must exist in the code. Feature audits after every large docs addition are mandatory.
- Features that are not yet implemented but are described in the docs must be marked with `> Planned for a future version`. Do not promise what isn't there.
- Build an audit table with the current state, run a gap analysis in A/B/C categories, then implement. No blind coding.

## Async in the FastAPI lifespan

- Inside the `async def lifespan(app)` handler the uvicorn event loop is already running. `asyncio.new_event_loop()` + `loop.run_until_complete(...)` is forbidden there and crashes with "Cannot run the event loop while another loop is running".
- When a helper like `sync_edge_tts_voices` needs to run a coroutine during startup: make the function `async` and `await` it in the lifespan, do NOT build your own loop.
- Symptoms when done wrong: `RuntimeWarning: coroutine '...' was never awaited` plus the loop conflict ERROR in the startup log.
- Other callers of the same function (CLI targets in the Makefile, sync FastAPI endpoints) have to follow along: `asyncio.run(...)` in the CLI, `async def` + `await` in endpoints.

## Deployment

- Default port: 7880 (not 8080, too often taken).
- /api/test/reset ONLY in debug mode (TOPOS_DEBUG=true).
- CORS configurable via TOPOS_CORS_ORIGINS (not hardcoded).
- SQLite path configurable with Docker volume persistence.
- TOPOS_SECRET_KEY is auto-generated by start.sh when not set.
- Non-root user in the Dockerfile.

## Licensing

### license_tier attribute
- PluginForge's BasePlugin is an external PyPI package - do NOT modify. Instead set `license_tier` as a class attribute directly on the plugin classes.
- `_check_license` in main.py reads `getattr(plugin, "license_tier", "core")` - the default is "core" (backward-compatible).

### Trial keys
- Trial keys use `plugin="*"` as a wildcard in the payload. `LicensePayload.matches_plugin()` must treat `"*"` explicitly as match-all.
- Trial keys are stored under the key `"*"` in `licenses.json`, not under the plugin name.
- Expiry: always use `date.today()` (UTC), not `datetime.now()`. `date.fromisoformat()` expects the "YYYY-MM-DD" format.
- `_check_license` must check both the per-plugin key and the wildcard key (fallback chain).

### Settings UI
- The `discoveredPlugins` API delivers `license_tier` and `has_license` per plugin. Currently all plugins are free (`license_tier = "core"`). The Licenses tab has been removed from Settings.

## Code structure

### Avoid God Methods
- Route handlers longer than 50 lines must be decomposed.
- Typical symptom: if/elif cascades for different formats/types in one handler.
- Solution: ExportContext dataclass + one function per format group + testable helper functions.
- Every extracted function must be testable without reconstructing the whole request context.
- See coding-standards.md "Function design" for the correct pattern.

### Testability as a design criterion
- If a function is hard to test (lots of mocking needed), that is a signal of bad design.
- Service functions must have no FastAPI dependencies (no Request, no Response, no Depends).
- Helper functions (validate_format, build_filename, detect_manual_toc) must be callable with simple parameters.
- Data classes (dataclass, TypedDict) instead of loose dicts for context between functions.

### Error-handling mistakes we made
- HTTPException thrown directly from services. Makes services untestable without a FastAPI context. Solution: our own exception hierarchy (ToposError).
- Bare `except Exception: pass` in plugin code. Errors vanish silently. Solution: catch specific exceptions, at least log them.
- External tool errors (Pandoc subprocess.CalledProcessError) passed up unwrapped. The user sees a cryptic error message. Solution: ExternalServiceError with a clear service name.
- Frontend: API calls without catch. User clicks "Export" and nothing happens. Solution: always try/catch with toast feedback and finally for the loading state.

### Error reporting rules
- Error details must make a GitHub Issue directly actionable, without follow-up questions.
- Chain: ToposError (detail + str(e)) -> API response (detail + traceback in debug mode) -> frontend ApiError -> toast with "Report issue" button -> GitHub Issue (title, stacktrace, browser, app version).
- EVERY except block MUST call logger.error() with exc_info=True.
- EVERY except block MUST include str(e) in the ToposError subclass (NOT HTTPException).
- EVERY frontend catch block MUST call toast.error() with the ApiError object, NOT just with a string.
- Generic error messages like "Export failed" or "Import failed" without details are FORBIDDEN. They make GitHub Issues worthless.
- File upload functions (fetch instead of request()) must throw ApiError on failure, not Error.
- The global exception handler in main.py logs every unhandled error with its stacktrace.
- In debug mode the backend response includes the stacktrace (for the "Report issue" button).

## Plugin settings: visible or INTERNAL, never hidden

Plugin settings are either UI-visible (user-relevant) or marked `# INTERNAL` (YAML-only). Hidden active settings that influence user behavior are a bug, because the user has no way to change the behavior without a YAML editor and repo access.

Dead settings (in the YAML but not read by the code) are just as bad: they are a lie to the user. When refactoring a plugin, always check whether old YAML fields are still consumed before leaving them in place.

Generic plugin settings panel on the frontend: renders booleans as a checkbox, numbers as a number input, strings as a text input, arrays as an OrderedListEditor, objects as a JSON textarea with an "Advanced" hint. Rendering a boolean as a text input (`value="true"`) is a UX bug because the user cannot tell it is a switch.

Configuration values that vary per entity (per container/item) MUST live on the relevant model as a column, NOT in the plugin YAML. Plugin YAML is plugin-global and applies to everything at once - anyone who needs per-entity granularity adds a column.

## Review architectural decisions before implementing

From the V-02 incident: there was a near-implementation of a
backup-compare feature (V-02) that would have been built in
parallel with the already-planned Git-based backup feature. Only
by cross-checking against todo-prompts.md did the conflict
become visible.

Rule: before implementing a larger architectural decision, check:
1. ROADMAP entries in the area
2. todo-prompts.md for already-planned changes
3. docs/journal/ for earlier discussed decisions

On a conflict between a user instruction and documented planning:
STOP and explicitly ask the user which version applies.
Never build parallel systems that are already slated for deletion.

## Dependency currency in active development

In active development projects, dependency versions should be kept current from day one. Shipping with end-of-life or deprecation-imminent versions creates technical debt immediately.

Rules:
- Only stable releases, no beta/RC/alpha versions ever in production code
- "Latest stable" means most recent version that has proven stable (minimum 2 weeks since release)
- For LTS products (Node.js), prefer Active LTS over Current
- Review dependencies at each release cycle: run `poetry show --outdated` and `npm outdated` before cutting any release
- Major version bumps get their own commit with migration notes
- Routine minor/patch bumps can be batched by category

Red flags for outdated dependencies:
- Deprecation warnings in build output
- End-of-life announcements in package READMEs
- Security advisories against installed versions
- Upstream pins blocking other upgrades (e.g. manuscripta ^0.8.0 blocking Pillow 12)

Upstream blockers: when an external dependency (e.g. manuscripta) pins a transitive dep (e.g. pillow <12), the bump is deferred until the upstream releases a compatible version. Document the blocker in the commit that updates what it can, so the next sweep picks it up.

## Release-cycle dependency review

Before cutting any release, run dependency currency check:
- `poetry show --outdated` in backend and each plugin
- `poetry show --outdated` in launcher
- `npm outdated` in frontend

Apply routine bumps (patch + minor + low-risk minor) as part of release prep. Defer major bumps to dedicated sessions with their own testing cycle.

Never ship with:
- End-of-life versions
- Deprecation-imminent versions (forced migration within 6 months)
- Versions with known unpatched P0 bugs

Stability filter:
- Latest stable only, never beta/RC/alpha
- Minimum 2 weeks since release for new major versions
- For LTS products (Node.js), prefer Active LTS over Current

## install.sh VERSION drift

- `install.sh` pinned `VERSION="v0.7.0"` as the default, but Dockerfile and docker-compose.prod.yml evolved significantly after that tag. The v0.7.0 compose used `build: ./backend` (backend-only context), while current uses `context: .` (repo root). Plugins live at `<repo>/plugins/` which is entirely outside the v0.7.0 build context, so `poetry install` inside the container could never find them.
- The fix for the original Docker bug (commit 59cf3d6) was verified by building from the local working tree, not by running install.sh end-to-end. The local build used the current compose/Dockerfile; install.sh used the ancient tagged version. The verification test was wrong because it didn't test the actual user flow.
- Rule: when fixing an install/deployment script, always test THE SCRIPT, not just the artifacts it references. `docker build -f Dockerfile .` is not the same test as `./install.sh` because the script may select a different version of the files.
- install.sh now pins to the latest release tag (updated as part of the release workflow, Step 4). Users can override with `TOPOS_VERSION=vX.Y.Z` for older versions.
- Corollary: install scripts are a special class of code where the test must simulate the actual distribution path. CI that tests scripts should run them the way users run them, not the way developers run them. `docker build -f Dockerfile .` from a working tree is not the same test as `curl ... | bash` which downloads, checks out a tag, and then builds.
- 2026-05-04 SSoT refactor: install.sh became a generated artifact built from `install.sh.template` + `backend/pyproject.toml` via `scripts/generate_install_sh.sh`. The committed install.sh stays in git because users curl-pipe it directly from the raw GitHub URL; it cannot be a build-time artifact hidden behind .gitignore. Treat it like generated docs: edit the template, regenerate at release time, commit both. `verify_version_pins.sh` runs `--check` to catch drift between template and committed output.

## Single source of truth for version pins

Every duplicated version constant is a stale-pin bug waiting to happen. The 2026-05-04 audit chain found seven such pins across launcher, frontend, install.sh, and one plugin - three were already stale (8 versions, 13 versions, and 3 versions behind the canonical pyproject.toml / package.json). Each had drifted because the release workflow listed them as bullets to manually update, with no enforcement.

Architecture goal (Java/Maven precedent): ONE version per subsystem in a canonical packaging file; everything else derives.

**Canonical sources (hand-edited at release):**
- `backend/pyproject.toml` for the Python subsystem
- `frontend/package.json` for the JS subsystem
- Each `plugins/<name>/pyproject.toml` for its own plugin (plugins have independent versions)

**Derivation patterns by language and runtime:**

| Subsystem | Pattern | Why |
|-----------|---------|-----|
| Python (publishable distribution) | `importlib.metadata.version("<dist-name>")` with `PackageNotFoundError` fallback | Standard. Reads packaging metadata; cannot drift. |
| Python (`package-mode = false`, e.g. backend app) | `tomllib.load(open("pyproject.toml", "rb"))["tool"]["poetry"]["version"]` | importlib.metadata is unavailable when Poetry doesn't register a distribution. tomllib is stdlib in 3.11+. |
| Bash installer (chicken-and-egg before clone) | Generate the script at release time from a template; substitute placeholder from canonical pyproject. Commit the generated artifact. | Runtime parse impossible because pyproject doesn't exist when curl-pipe runs. GitHub-API-at-runtime is non-deterministic and brittle. |
| Frozen binary (PyInstaller) | Build-time injection: spec script writes a generated `_build_info.py`, gitignored, that the binary embeds. Dev fallback reads pyproject directly. | importlib.metadata is unreliable inside PyInstaller's frozen tree. |
| Frontend (Vite) | `define` block reads package.json at build, exposes `__APP_VERSION__` literal. TypeScript declares `declare const __APP_VERSION__: string;` in `vite-env.d.ts`. | Build-time literal substitution. Zero runtime cost, zero bundle overhead. |

**Always include a fallback sentinel** (e.g. `"0.0.0+unknown"` with a `logger.warning`) when the derivation can fail at runtime (file missing, distribution not registered). Silent fall-through to a hardcoded number masks environmental problems.

**Always include regression detectors** in `verify_version_pins.sh`: grep patterns that fail the check if a hardcoded literal reappears in the "DO NOT EDIT" tier. Workflow checklists alone are not enforcement; a script that exits non-zero on regression is.

**Never** add a hardcoded version constant "for convenience" (e.g. for use in a GitHub-Issue body template, a footer string, or an OpenAPI metadata field). Always reference the derived single source.

## Hotfix cluster tag policy

When a release tag fails CI for a mechanical reason (chmod bit
missing, formatter nit, type-check escape, build-time spec error)
and a fix lands quickly via point-release bumps, the failed tag
stays in the repository as historical record - it does not get
deleted. Reasons:

- The v0.26.0 release-gate run, even though it failed, is part
  of the release audit trail (run ID `25328065614`).
- Deleting a published tag is a force-push class operation per
  CLAUDE.md security rules; allowed only when nobody pulled the
  tag and no GitHub Release was published. The latter is
  satisfied for failed-gate tags but the former requires
  asserting nobody fetched in the meantime.
- Each tag's commit reflects the state at the moment of the
  bump. Future bisects can use them.
- The shipped tag's `changelog/releases/v0.X.Y.md` file
  documents the hotfix history (see v0.26.3.md "Hotfix
  history" section as the template).

Current cluster preserved as-is: `v0.26.0` (release-gate failed
on chmod), `v0.26.1` (launcher builds failed on PyInstaller
spec `__file__`, CI failed on mypy), `v0.26.2` (CI failed on
ruff-format), `v0.26.3` (all green; the shippable tag).

Do delete a tag only when it was pushed in the last few minutes
and the user explicitly confirms no one could have pulled. The
default is keep + document.

## Subsystem lock-step + tooling, not checklists

Per-subsystem SSoT (one canonical pyproject per Python subsystem, one canonical package.json for the JS subsystem) was the first half of the fix. The second half is **lock-step propagation by tooling, not by human attention**. A 7-row checklist that says "edit every file" fails every time someone forgets a row; the 2026-05-04 audit chain found three pins that had drifted by 8, 13, and 3 versions respectively across multiple releases.

Architecture, post-2026-05-04 lock-step:

- **One canonical version per language subsystem** (backend/pyproject.toml, frontend/package.json). Hand-edited at release time.
- **`make sync-versions`** (`scripts/sync_versions.py`) propagates the canonical to every other version-bearing field: launcher pyproject + spec plist + `__init__.py` literal, all plugin pyprojects, frontend package.json (when needed), `install.sh` regen via the existing template helper. The tool is the only thing that touches those files.
- **`make sync-versions-check`** + `verify_version_pins.sh` enforce lock-step in a tight loop. The verify script also runs the subsystem-lock-step check inline.
- **CI gate** (`.github/workflows/release-gate.yml` on tag-push, plus the same checks inlined as the first step of every launcher build job's `release: created` path). Artifact attachment is blocked on drift. Tag pushes cannot be retroactively undone, but the gate failure surfaces the drift loudly and prevents downstream artifact publication.

Rules for working in this codebase:

- **Do not hand-edit any version field except `backend/pyproject.toml`.** Even the assistant doing the work follows this rule. If the assistant bypasses the tool and edits a downstream pyproject directly, the tool's value is zero from day one. Run `make sync-versions` and let the diff speak.
- **Each release commit's diff for non-canonical version fields must be reproducible by re-running `make sync-versions` from a clean checkout.** That's the bisect contract: any historical commit can be re-derived from `backend/pyproject.toml` + the tool.
- **A new subsystem with its own version field**: add it to `scripts/sync_versions.py`'s `collect_targets()` AND the regression detector in `verify_version_pins.sh` AND the CI gate. Three artifacts per new pin; never one or two.
- **The `--check` mode of every sync/verify script must be idempotent**: running it twice in a row produces the same answer, never writes, never depends on environment state beyond the repo. CI relies on that property.
## Diagnostic features must fail open

- Diagnostic and convenience features should fail open. A feature that prevents bad behavior (double-launch, stale cache, etc.) must not block the application's primary function when it fails. Crashing the app because a convenience check crashed is always worse than silently skipping the convenience check.
- Concrete example: the launcher's lockfile check (`another_instance_alive`) crashed with `TypeError: argument of type 'NoneType' is not iterable` because `tasklist` returned `stdout=None` on a Windows locale edge case. This prevented every user from starting the launcher at all. The fix: wrap in try/except that fails open (log warning, proceed).
- This applies beyond lockfiles. Any startup check, guard, or health probe that gates the main application flow should be wrapped so that a failure in the check degrades gracefully rather than killing the app.

- Shallow clone update trap: `git clone --depth 1 --branch v0.7.0` creates a repo where `origin/main` does not exist as a remote ref. A later `git fetch origin` does not fix this because the fetch refspec was configured for the tag, not for branch tracking. `git checkout -B main origin/main` then fails with "pathspec 'main' did not match". The fix is to not try to update shallow clones in place at all. Delete and re-clone (backing up .env first) is the only reliable cross-platform approach. Surgical git state repair across shallow clone versions, platforms, and git implementations is a losing battle.

## TypeScript 6 no longer auto-includes all `@types/*`

- TS 5 silently included every `@types/*` package from `node_modules` when the `types` compilerOption was absent. TS 6 stopped doing this: if `@types/node` is installed transitively but not named in `types`, `import fs from "node:fs"` fails with `TS2591: Cannot find name 'node:fs'`.
- Concrete: `frontend/src/components/ChapterSidebar.test.tsx` imports `node:fs`/`node:path` to load fixture data. Worked under TS 5 (`@types/node` came in transitively via `happy-dom`/`vite`/`vitest`). Broke on TS 6 bump.
- Fix: add an explicit `@types/node` devDependency AND list it in `tsconfig.json` under `"types": ["node", "vite/client"]`. Both halves are needed - installing the package alone does not bring it in on TS 6.
- Applies going forward: any `@types/*` you want in scope under TS 6 must be named in `types` explicitly.

## `@types/node` major bumps cascade into tsconfig `lib`

- `@types/node@22` shipped polyfilled lib augmentations (e.g. typing `Array.prototype.at()` even under `lib: ES2020`). `@types/node@24` dropped them, deferring entirely to whatever lib the project declares. Symptom on a ^22 → ^24 bump: `TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.` even though no source code changed.
- This is NOT a breakage in `@types/node`; it is correct behavior. The earlier convenience was the anomaly.
- Fix at the consuming repo: bump `tsconfig.json` `target` and `lib` to `ES2022` together with the `@types/node` major bump. `Array.prototype.at()` is ES2022 standard library. Vite 8 / esbuild emit ES2022 fine; runtime is Node 24 / modern browsers. Zero source-side changes required.
- General rule: when bumping `@types/node` across majors, run `tsc --noEmit` in the same change window. If it newly fails on stdlib globals, bump `lib` to match the runtime ES level - do NOT carry per-call workarounds (`as any[]`, casts) and do NOT pin `@types/node` back to the old major.
- Concrete bump landed 2026-05-07 in commit on `main` after the v0.28.0 cycle: `^22.19.17` → `^24.12.2`, `target` + `lib` ES2020 → ES2022, 8 `.at(-1)` sites in `PreviewPanel.test.tsx` cleared without modification.

## Vite 7 requires Node 20.19+ / 22.12+

- Vite 7 uses Node's `crypto.hash` top-level API which landed in Node 20.12+ / 21.7+ (backported to 22 LTS). On Node 18, `vite build` fails with `[postcss] crypto.hash is not a function` coming from `vite-plugin-pwa`'s postcss handling. The error is misleading: it is not a PWA/postcss bug, it is a Node version issue.
- Vitest 4 does NOT exercise the same code path, so `npm run test` can still pass on Node 18 even though `npm run build` fails. Do not rely on tests alone to validate a Vite major bump; always build too.
- CI runs Node 24 (`.github/workflows/{ci,coverage}.yml`), which is fine. Local envs on Node 18 must upgrade to Node 24+.

## Vite 8 migration (DEP-09 + SEC-01)

- `vite-plugin-pwa@1.3.0` (published 2026-05-06) added Vite 8 to its peer-dep range (`^3.1.0 || ^4 || ^5 || ^6 || ^7 || ^8`) and unblocked the bump. The CVE chain `workbox-build` -> `@rollup/plugin-terser` -> `serialize-javascript` (3 high-severity advisories: GHSA-5c6j-r48x-rmvq RCE + GHSA-qj8w-gfj5-8c6v DoS) clears as a side effect; `npm audit --audit-level=high` returns zero high findings after the bump. The unrelated moderate `uuid` advisory (GHSA-w5hq-g745-h8pq) stays open and is its own track.
- **Vite 8 (Rolldown) requires `manualChunks` as a function, not an object.** Vite 7 used Rollup, which accepted both forms. Vite 8 ships Rolldown by default, which only accepts the function form. Symptom: `Invalid output options ... For the "manualChunks". Invalid type: Expected Function but received Object` followed by `TypeError: manualChunks is not a function at rolldown/dist/shared/...`. Fix: convert the package-list-per-chunk object to a function that matches the module id and returns the chunk name. Use a trailing slash (`id.includes('/node_modules/${pkg}/')`) to prevent prefix collisions (`react` vs `react-dom` vs `react-router-dom`). The `id` is always an absolute path; bare-package matching is unreliable.
- DEP-04 landed Vite 6 -> 7 deliberately because vite-plugin-pwa 1.2.0 did not yet ship Vite 8 compat; DEP-09 + SEC-01 paired in one session because both items resolve on the same upstream release.
- Vitest 4 covers the matrix `vite: ^6 || ^7 || ^8`; bumping Vite alone keeps Vitest configuration untouched. The `@vitest/coverage-v8` peer-dep is exact-pinned to its own Vitest version, so when bumping Vitest itself bump both in lockstep or `npm install` will downgrade the parent.
- The check that caught this in production was the build step, not the test step (per `lessons-learned.md` rule "Do not rely on tests alone to validate a Vite major bump; always build too"). Vitest 707/707 passed with the broken `manualChunks` config. `npm run build` was the first signal.

## German content uses real umlauts

Production German content uses proper UTF-8 umlauts (ä, ö, ü, ß),
NOT ASCII transliterations (ae, oe, ue, ss).

### Where this applies (real umlauts required)

- i18n catalogs (`backend/config/i18n/de.yaml`).
- User documentation (`docs/help/de/**/*.md`).
- Plugin German content (under any `*/content/de/`).
- README German sections (currently none; English-only).
- CHANGELOG German entries (rare; quoted UI strings only).
- Journal entries written in German prose.
- Any other user-facing German text.

### Where ASCII stays

- Source code (`*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`).
- Code comments, docstrings (English convention).
- Variable / function / class / identifier names.
- File names, directory names.
- Git branch names, commit messages.
- This chat with the user (per the user's style preference,
  ASCII-only in chat communication).

The chat-style rule and the production-content rule are
deliberately different. Production text is authored for end
readers; the chat is a working channel.

### Tooling

`scripts/find_umlaut_candidates.py`, `scripts/replace_umlauts.py`,
`scripts/build_in_scope_list.py`, and
`scripts/discover_unknown_umlauts.py` implement a whitelist-based,
reviewable workflow:

1. Run `python3 scripts/build_in_scope_list.py` to regenerate
   `/tmp/in-scope-files.txt` from the policy below.
2. Run `python3 scripts/discover_unknown_umlauts.py` to find any
   ASCII transliterations NOT yet in `KNOWN_WORDS`. Add real
   German words to the whitelist (one entry per declined form);
   add false positives to the script's `NOT_TRANSLITERATIONS`
   set so future runs stay quiet.
3. Run `python3 scripts/find_umlaut_candidates.py` against the
   expanded whitelist; review `/tmp/umlaut-candidates.json`.
4. Run the replacer with `--dry-run` first; review diffs.
5. Apply per-file with `y / N / q` prompts; after 5 clean
   replacements the prompt offers `a` (yes-to-all) — only opt in
   when every prior diff was clean.
6. Re-run the finder to confirm 0 remaining candidates.
7. UTF-8 readback every changed file before committing.

Scope policy (encoded in `build_in_scope_list.py`):

In scope:
- `backend/config/i18n/de.yaml`
- `docs/help/_meta.yaml` (display labels are German prose)
- `docs/help/de/**/*.md`, `docs/journal/**/*.md`,
  `docs/explorations/**/*.md`
- `docs/CHANGELOG.md`, `docs/CONCEPT.md`, `docs/ROADMAP.md`,
  `docs/backlog.md`
- `plugins/*/content/de/**/*.md`,
  `plugins/*/topos_*/content/de/**/*.md`
- `README.md`

Explicitly NOT in scope (do not add):
- `.claude/rules/*.md` — rules are English; only the policy
  examples reference umlauts as illustration.
- Source code (`*.py`, `*.ts`, `*.tsx`) — identifiers stay ASCII.
- Auto-translated non-DE i18n YAMLs (es/fr/pt/tr/ja/el/en) —
  separate diacritic-coverage track (I18N-DIACRITICS-01).

The finder masks Markdown code regions (fenced + inline +
indented). For YAML / config files (suffix `.yaml` / `.yml`), the
indented-code rule is skipped because YAML indentation is data,
not code. Word-boundary regex (`\b...\b`) prevents partial
matches inside compound identifiers.

### Why this matters

ASCII transliteration looks unprofessional to German readers and
renders inconsistently once the surrounding text uses proper
umlauts - the mixed-encoding pattern is the worst case (same
file, two styles). It reaches users through the Excel export and
the printed container labels, not just the screen.

### Known regression pattern

Mixed-encoding files (BOTH real umlauts AND ASCII transliterations
in the same paragraph) are not tooling regressions but author-
style drift: typing in an environment without a German IME, then
copy-pasting UTF-8 text from elsewhere. There is no
heading / code-fence / section boundary to predict it.
Mitigation: the scripts above run cleanly per-session against
any new German prose; the `roadmap-archive-reminder` pre-commit
hook can be extended later to add an umlaut check the same way.

## Global CSS rules: distinguish viewport containers from app container

Setting `overflow: hidden` on `html, body, #root` as a single rule blocks document scroll but also blocks every full-page component that relied on scroll (Settings, Dashboard, GetStarted, Help).

Correct pattern when preventing document-level scroll for editor zoom behavior:

```css
html, body { height: 100%; overflow: hidden; }  /* viewport lock */
#root { height: 100%; overflow-y: auto; }       /* app scroll */
```

html and body control the browser viewport. `#root` is the React application root and must remain scrollable for pages that don't implement their own scroll container.

When a layout fix requires setting `overflow: hidden` on one of the three, think explicitly about whether full-page components inside the app need internal scroll, and expose it via `#root`.

### Incident record

Inherited from the template lineage, and worth keeping: Topos hit
the same shape when `#root` gained flex centring (see the CSS block
in `frontend/src/styles/global.css`, which now documents why
`height: 100%` + `overflow-y: auto` are load-bearing).

- `ef7ce5c`: added `html, body, #root { overflow: hidden; }` to fix a sidebar at 150% zoom. Broke scrolling on every full-page view.
- `c25483e`: split the rule. Kept html/body locked (preserves the zoom fix), restored `#root overflow-y: auto`.

## Filesystem isolation: production data lives outside the project tree

Production Topos data NEVER lives in the project tree. All paths resolve via `app.paths` helpers (`get_data_dir`, `get_config_dir`, `get_cache_dir`, `get_upload_dir`, `get_db_path`) which use platformdirs (XDG-conformant) by default and respect a `TOPOS_DATA_DIR` (etc.) env-var override. Resolution is **always** via fresh function calls, never via frozen module-level imports.

Default locations (Phase 2 swap, 2026-05-04):

- Linux/macOS: `~/.local/share/topos/`
- Windows: `%LOCALAPPDATA%\topos\`
- Tests: a `tmp_path_factory`-managed dir, set by `backend/tests/conftest.py` before any `app.*` import
- Docker: `/app/data/` via `TOPOS_DATA_DIR=/app/data` in compose, mounted as the named `topos-data` volume

Three layers of protection prevent test runs from touching production data:

1. **Production marker file**. Production directories contain a `.topos-production` marker (written by the FastAPI lifespan via `app.paths.mark_data_dir_as_production`). If tests ever see one, the entire run aborts with `pytest.exit(returncode=2)`.
2. **Test conftest sets `TOPOS_DATA_DIR`** to a tmp dir before any `app.*` import. The autouse session fixture also asserts the resolved path looks like a tmp location.
3. **All path access via helpers**, never via CWD-relative `Path("foo")` and never via frozen module-level imports.

**Forbidden patterns:**

- `UPLOAD_DIR = Path("uploads")` at module top level
- `from app.routers.assets import UPLOAD_DIR` (frozen import)
- `Path("data") / "X"` anywhere in production code

**Required pattern:**

- `upload_dir = get_upload_dir()` inside the function that uses it.

If `make test` aborts with exit code 2, check what path was mounted via `TOPOS_DATA_DIR`. NEVER delete the marker just to make the test pass; investigate why a test pointed at production. Origin: April 2026 data-loss incident — DB tripwire landed in `a4cf7cf`, filesystem tripwire + paths.py in the same period.

### Phase 2 migration

Users with v0.25.0-and-earlier data in the project tree (`backend/topos.db`, `backend/uploads/`) get auto-migrated on first start after the platformdirs swap. Helper: `app.data_dir_migration.migrate_data_dir_if_needed`, run from the FastAPI lifespan BEFORE `init_db()`. Properties:

- Idempotent (`.migration-complete` marker short-circuits)
- Fail-loud on conflict (RuntimeError if both legacy and target hold the same item; silent merge would corrupt data)
- Breadcrumb at old paths (`.migrated-YYYY-MM-DD` file beside each moved item)
- Skipped in test mode (`TOPOS_TEST=1`)

Rule: when adding a new persistent path under `get_data_dir()`, also add it to `_legacy_paths()` in `data_dir_migration.py` if a v0.25.0-and-earlier code path could have written to a different location. Otherwise users lose data on the next upgrade.

## Two installation paths diverge: `make test` vs per-plugin CI

Topos's plugins are installed two different ways depending on context:

- **`make test` path:** the backend's combined `poetry.lock` resolves every plugin as a path-dep (`topos-plugin-{name} = {path = "../plugins/...", develop = true}`). One `poetry install` from `backend/` brings every plugin's external deps in via the backend's lock.
- **CI plugin-matrix path:** `.github/workflows/ci.yml` and `.github/workflows/coverage.yml` run `poetry install --no-interaction --no-ansi` **inside each plugin directory** against THAT plugin's own `poetry.lock`. The backend lock is irrelevant here.

When a shared external dep (e.g. fastapi) bumps in every pyproject (backend + 10 plugins), the backend lock and the per-plugin locks drift independently. If only the backend lock gets regenerated:

- `make test` is green (the backend lock satisfies all path-deps; the per-plugin locks are not consulted).
- CI is red (the per-plugin `poetry install --no-interaction` aborts with `pyproject.toml changed significantly since poetry.lock was last generated`).

This shape bit during the v0.30.0 release: the pre-v0.30.0 dep sweep bumped fastapi `^0.135.0 → ^0.136.0` in 11 pyproject.toml files, but `poetry lock` was only run in `backend/`. Local `make test` passed; CI was red on main from `be4b6f3` until hotfix `3232fad` re-locked all 10 plugin lockfiles.

**Generalization:** any time there are two installation paths for the same code, BOTH must be tested at gate time. The backend's combined lock and the per-plugin locks are different gates; verifying one does not verify the other. The pre-v0.30.0 retro called this out at the meta level ("verify the gate before trusting it"); this is the concrete recurrence.

**Mitigation pattern (now enforced):**

- `make lock-all-plugins` (Makefile target shipped in PLUGIN-LOCKFILE-DRIFT-01 commit `1b43aec`): iterates `plugins/topos-plugin-*/` and runs `poetry lock` in each. Use after any shared-dep pin bump.
- `make verify-plugin-locks` (Makefile target shipped in the same commit): runs `poetry install --dry-run --no-interaction --no-ansi` per plugin and greps for "changed significantly". Exits 1 with a remediation hint on drift; manual diagnostic, NOT in the pre-tag chain (the pre-commit hook below + the CI per-plugin matrix already cover the right times).
- Pre-commit hook `plugin-lock-paired-with-pyproject` (shipped in commit `8f6fcea`): scoped via `files: ^plugins/topos-plugin-[^/]+/pyproject\.toml$`, fails when a staged plugin pyproject lacks a paired staged `poetry.lock`. Catches the operational mistake at commit time. Verified by 6 hook self-check tests in `backend/tests/test_plugin_lock_drift_hook.py` (commit `e31c4fd`), all green at 0.22 s.
- Discovery channel without these gates: CI red on main, AFTER a release tag has already been cut. The retro's commitment to "discrete pre-release dep sweep commits" pays off (rollback granularity stays intact), but the better gate is to catch the drift before push, not from the GitHub Actions red badge.

## React `useEffect` deps + i18n test mocks: the `t` function isn't stable

Symptom: a component's fetch-on-open effect kept failing in tests
because the `setError` call in the rejection branch never landed.
Looked like a race condition but wasn't. The effect's dep array
included the i18n `t` helper:

```typescript
useEffect(() => {
    let cancelled = false
    api.something.fetch(...)
        .then(...)
        .catch((err) => {
            if (cancelled) return
            setError(...)
        })
    return () => { cancelled = true }
}, [open, kind, ids, t])  // <-- t here
```

In production the i18n provider memoises `t` so the dep is stable.
In the test setup, the i18n mock returns a fresh `t` function on
every render:

```typescript
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k, fallback) => fallback, ...}),
}))
```

Result: every parent re-render produces a new `t`, so the effect
cancels its prior run and refetches. The rejection from the
previous run lands while the new run's `cancelled` closure is
still false, BUT the previous run set `cancelled=true` in its own
closure. The catch sees `if (cancelled) return` and bails out
before `setError` fires. The error never surfaces to the user.

Fix: omit `t` from the dep array when the request shape doesn't
actually depend on it (the fallback string in the toast was the
only consumer). Add an `eslint-disable-next-line` with a comment
explaining why:

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, kind, ids])
```

Generalises to any hook function the i18n mock returns fresh per
render — `useDialog`, `useNavigate` (when its callback closure
captures state), etc. When a test fails because a state update
"never happens" but the production code looks correct, check the
effect dep array against the hooks consumed inside it.

The right fix is NOT to memoise the mock's `t` per-render (that
defeats the point of mocks). The right fix is to scope the
effect's deps to what genuinely affects the request.

## Operational gaps masquerade as wired infrastructure

The 2026-05-12 test-infrastructure audit surfaced a concrete
example: the mutmut workflow at
``.github/workflows/mutation-import.yml`` had been WIRED in
the repo for 10 days (since 2026-05-02, commit ``28fe59c``)
but had NEVER produced a successful run. The nightly cron
was gated by the ``ENABLE_NIGHTLY_MUTATION`` repo variable
(not enabled); no maintainer had manually
``workflow_dispatch``-ed the workflow either. The audit
trigger was the first invocation.

The job completed in 1m12s (vs. 20-40min expected) because
``mutmut run`` errored during its initial
``run_stats_collection`` phase with
``BadTestExecutionCommandsException``. The exact pytest
invocation mutmut used (``--rootdir=. --tb=native -x -q
tests/``) succeeded cleanly when run by hand — so the
failure was inside mutmut's own pytest plugin, not pytest.
But until the workflow was actually triggered, this bug was
invisible: the YAML existed, the audit-doc
(``docs/audits/mutmut-2026-05-02-import.md``) carried the
note "TBD — pending first CI run", and the AGAR-feeling of
having mutation-testing-infra was at full strength.

The lesson generalizes:

- **"Wired" ≠ "working".** A workflow / hook / cron /
  scheduled job that was committed without being executed
  end-to-end is a hypothesis, not a feature. Audits should
  validate that wired infrastructure actually runs to
  completion, not just that the YAML / config exists.
- **The right time to flip such switches is at wire time,
  not at audit time.** A maintainer who wires mutmut /
  Hypothesis / any new pipeline should
  ``workflow_dispatch`` the workflow at least once before
  declaring the work done, and surface the artifact + result
  in the same PR / commit. The 2026-05-02 mutmut wiring
  shipped without this validation; the bug then lay dormant
  for 10 days.
- **Audits that find these gaps are doing their job.** The
  audit didn't fail to "implement mutmut"; it accurately
  reported that the wired mutmut workflow is operationally
  blocked, which is a more useful data point than another
  abstract "we should adopt mutmut" recommendation.

Concrete rule: when wiring a new CI workflow, schedule it,
or otherwise add infrastructure that runs on a delayed
trigger (nightly cron, on-tag, on-paths-only, gated by repo
variable), trigger it manually at least once in the same
session, download the artifact, and confirm the result is
what you intended. Document the first run's outcome in the
PR description or the related audit doc. A workflow that
ships without a known-good first run is technical debt
masquerading as feature delivery.

## Run vitest from `frontend/`, not the repo root

Vitest's config lives in ``frontend/vite.config.ts``.
Running ``npx vitest run`` from the repo root finds no
config, defaults to the `node` environment, and produces
``ReferenceError: document is not defined`` across every
test that touches the DOM. In a real 2026-05-12 incident,
**101 of 120 test files failed** with this error before
I noticed the cwd was wrong — completely misleading red
flag suggesting something I'd just edited broke the entire
test environment.

Tells in the failure output:

- Per-file ``setup: 0ms`` (happy-dom didn't initialise).
- ``environment: 0ms`` in the summary line.
- The error itself: ``ReferenceError: document is not
  defined`` (or ``window`` / ``HTMLElement`` / similar).
- Files that passed earlier in the same session
  suddenly all fail.

Three reliable invocations:

- ``make test-frontend`` from anywhere (the Makefile
  cd's into ``frontend/`` before running vitest).
- ``cd frontend && npx vitest run`` — direct, fast,
  same result as the Makefile target.
- ``cd frontend && npx vitest run src/path/to/file.test.tsx``
  for a targeted re-run.

Failure modes:

- ``npx vitest run`` from repo root → no config found
  → wrong environment → 100% red flag on DOM-touching
  tests.
- ``poetry run vitest`` (mixed up with backend tooling)
  → vitest not in the Python venv → command-not-found.

Concrete rule: when a recent edit "breaks every vitest
file at once," check the cwd before suspecting the code.
A green run minutes ago in the same session and a red
run now with ``setup: 0ms`` is the cwd diagnostic, not a
regression.

## `poetry update` vs `poetry lock` semantics

Surfaced during the 2026-05-12 dep-update audit Phase 3.
The ``make lock-all-plugins`` target runs ``poetry lock``
per plugin. ``poetry lock`` validates that existing
resolutions still satisfy current pyproject constraints —
it does NOT refresh transitives to their latest within the
allowed range. ``poetry update`` does that.

So:

- **``poetry lock``** = "re-resolve from pyproject specs."
  Only meaningful after a pyproject pin changed. No-op when
  nothing in pyproject changed (the existing lock is still
  a valid resolution).
- **``poetry update <pkg>``** = "move this package (and its
  transitives) to the latest within range." Touches the
  lock; pyproject is unchanged unless the new version
  exceeds the caret.
- **``poetry update`` (bare)** = "move EVERY package within
  every range." Maximally aggressive; pulls every patch +
  every minor + every transitive-of-transitive. Risky:
  one low-risk direct bump can pull a high-risk transitive
  via the upstream's relaxed bounds (see next rule below).

The ``make lock-all-plugins`` target serves the "pyproject
changed" case (e.g. after a shared-dep pin bump propagated
to every plugin via ``sync-versions``). It is NOT a "pull
patch transitives" tool. Use ``poetry update <allowlist>``
per plugin for that purpose.

Concrete rule: when "the lockfile didn't change after
``make lock-all-plugins``", check whether any pyproject
changed. If none, the no-op is correct. If patch
transitives are still wanted, switch to a per-plugin
``poetry update`` with an explicit allowlist.

## Transitive deps can surface high-risk packages from low-risk direct bumps

Surfaced during the 2026-05-12 dep-update audit Phase 3,
on a single test plugin run before going wider.

Bare ``poetry update`` on ``topos-plugin-help`` (one of
11 plugins, used as a pre-flight test) pulled:

- ✅ ``pydantic 2.12.5 -> 2.13.4`` (low-risk patch)
- ✅ ``idna``, ``packaging``, ``coverage``, ``pygments``
  (audit-low-risk batch)
- ⚠️ ``fastapi 0.135.3 -> 0.136.1`` (the plugin pins
  ``^0.136.0``, so 0.136.1 is in-range; backend is at
  0.136.0)
- 🚨 ``starlette 0.46.2 -> 1.0.0`` — explicitly
  audit-deferred as high-risk

Cause: FastAPI 0.136.1 relaxed its upper bound on
starlette. A transitive walk through this relaxed bound
pulled starlette 1.0, the package the audit had
specifically deferred. The plugin's lock was reverted
immediately (``git checkout`` + ``poetry install``
downgraded back to 0.46.2).

The general shape: **low-risk direct bumps can pull
high-risk packages transitively when the upstream
relaxes a bound.** Even an audit that correctly
categorised packages by direct risk can miss this if
the audit didn't model transitive cascades.

Concrete rule for any bulk-bump pass:

1. **Pre-flight a single instance before bulk-applying.**
   One test plugin / one test environment, never blind
   bulk. The 2026-05-12 audit caught the starlette
   surfacing on plugin #1 of 11; revert was cheap.
2. **Prefer ``poetry update <allowlist>`` over bare
   ``poetry update``.** The allowlist constrains which
   packages can move; transitives only move if their
   own version constraint demands it. Example for the
   plugin-Pydantic alignment use case:
   ``poetry update pydantic pydantic-core`` (NOT
   ``poetry update``).
3. **If the audit deferred a package as high-risk, add
   a regression check.** Grep for the package name in
   the resulting lock-diff before committing; if it
   appears in the diff despite not being in your
   allowlist, surface and revert.
4. **The "two installation paths" rule still applies.**
   A backend-only lock-resolution test is not enough;
   a transitive surfacing in a plugin lock would only
   appear when you actually run that plugin's
   ``poetry install``. Per-plugin CI catches this; a
   one-time pre-flight runs faster.

## Audit findings need production-vs-dev environment classification before urgency-tier

Surfaced during the v0.31.0 pre-release verification (2026-05-13).

The D2 verification audit reported "GET /api/backup/export
returns HTTP 500 with `PermissionError: 'config/backup_history.json'`
in Docker" and classified it as a data-loss-class release-
blocker. The technical finding was correct: the path was a
CWD-relative literal that violated the explicit
"Filesystem isolation: production data lives outside the
project tree" rule. But the urgency classification was
overstated by one environment-class. The actual breakdown:

- **Dev Docker** (the `docker-compose.yml` bind-mount path
  `./backend:/app`): the bind mount inherits the host's UID,
  so the container's `topos` user cannot write to the
  project tree. The endpoint crashes; the bug is real for
  every contributor who runs `docker compose up` from the dev
  compose.
- **Production Docker** (`docker-compose.prod.yml`, no bind
  mount on `/app`): the Dockerfile does
  `RUN groupadd -r topos && useradd -r -g topos
  topos && mkdir -p /app/data && chown -R topos:topos
  /app` then `USER topos`. The container's user OWNS the
  entire `/app/` tree including `config/`. The CWD-relative
  write happens to land in a writable directory. The bug
  **never fired in production**.

The fix still ships (defense-in-depth + the filesystem-
isolation rule still applies + alignment to a consistent
behaviour across both environments), but the urgency tier is
"correct architectural cleanup" not "data-loss class
release-blocker". Verification command for any future audit
that suspects a Docker write-path failure:

```bash
docker exec <prod-container> sh -c \
    "ls -la /app/<the-path-under-suspicion> && \
     touch /app/<dir>/probe-write && rm /app/<dir>/probe-write && \
     echo WRITABLE || echo READONLY"
```

This separates "broken in dev only" from "broken in prod
also" before scope-setting any fix.

**Rule for future audit reports**: when a finding is "X
crashes with PermissionError in Docker", the audit MUST
distinguish which Docker setup (dev with bind mount vs prod
with named volume) before assigning urgency. The same code
path can be fatal in one and harmless in the other. Audit
reports that omit the environment distinction will lead to
either over- or under-urgent triage.

**Concrete artefact from the v0.31.0 cycle**: the Phase 2
path-isolation fix (commit `a341b57`) is correct, ships,
and is properly motivated by the architecture rule. But the
"prod blocker" framing was wrong — it was a dev-environment
blocker AND an architecture-consistency improvement, NOT a
production data-loss bug. The broader fix for the 10+
remaining `_base_dir / "config" / "app.yaml"` writes in
`backend/app/routers/settings.py` was deferred as
`PROD-WRITES-ARCHITECTURE-01` (P3) on the same reasoning:
production is fine, dev quirk eventually deserves the
broader cleanup but not at v0.31.0 release-blocker urgency.

## Radix DropdownMenu + happy-dom is brittle for Vitest

Surfaced 2026-05-14 across the v0.32.0 F2c (ArticleEditor
kebab) and F3 (Toolbar Copy chevron) sessions. Radix
DropdownMenu (`@radix-ui/react-dropdown-menu`) renders its
menu content through a portal and uses pointer events plus
focus-scope state for the open transition. happy-dom's
portal + focus-scope simulation is incomplete, so a Vitest
that mounts a component using DropdownMenu can:

- Render the trigger button correctly (works).
- Open the menu on `fireEvent.click(trigger)` —
  intermittent. Sometimes the menu content never lands in
  the DOM; sometimes it lands but `findByTestId` for an
  item inside `<DropdownMenu.Portal>` returns nothing.
- Throw `setState during render` from
  `@radix-ui/react-focus-scope` when both
  `fireEvent.pointerDown` + `fireEvent.click` fire in
  rapid succession (the workaround pattern most
  documentation suggests).

The F2c session burned ~30 min trying every combination of
`fireEvent.click`, `fireEvent.pointerDown` +
`fireEvent.pointerUp`, `userEvent.click`, and adding
`act()` wrappers. None of them produced a stable test.

Concrete rule for new Vitest files that exercise a Radix
DropdownMenu:

1. **Test the trigger button's existence** via
   `findByTestId` on the trigger. This works reliably and
   pins regressions where the trigger disappears entirely
   (e.g. the kebab gets accidentally hidden behind a
   conditional).
2. **Do NOT attempt to assert on the menu content** via
   `findByTestId` inside `<DropdownMenu.Portal>`. The portal
   timing in happy-dom makes this flaky. Defer the assertion
   to an E2E spec in a real browser.
3. **Test the action handler in isolation** when the
   handler is non-trivial — pass the handler in by prop or
   extract it from the component so the unit test can invoke
   it directly. The F3 Toolbar tests do this: the primary
   Copy button (not behind a portal) gets full Vitest
   coverage including clipboard write and toast assertions;
   the chevron dropdown's two items are covered only by the
   matching Playwright spec.

If a future test needs reliable DropdownMenu-open in unit
tests, consider:

- A test-only `defaultOpen` prop on the wrapping component.
- A controlled-open variant in production code that the test
  can force open.
- Switching to a non-portal alternative for the menu.

None of these is worth the complexity for the current use
cases; the E2E split is the cleaner answer.

## External GitHub Action major-version drift

Standard GitHub Actions (`actions/checkout`, `actions/setup-*`,
`actions/upload-artifact`, `actions/cache`, the pages trio, plus
common third-parties like `softprops/action-gh-release`) release new
majors periodically — usually triggered by Node runtime
deprecations or other GitHub-platform shifts. An audit finding "all
standard actions are at their current majors" is correct AT THE
TIME but stales within weeks-to-months after a deprecation
announcement.

Concrete trigger from the 2026-05-14 sweep: GitHub deprecated the
Node 20 runtime on 2025-09-19 (forced default 2026-06-02, removed
2026-09-16). Within 6 months, EVERY standard action listed above
released a new major moving to Node 24. The previous CI-hygiene
audit's `actions/checkout@v4` etc. was accurate at audit time but
the warnings re-appeared in CI within weeks.

The original test-infrastructure audit categorized "all standard
actions at current majors" as **no action needed** — accurate at the
moment, no longer accurate weeks later. Re-classify as a periodic
check, not a one-time verification.

### Periodic CI-hygiene check (every ~quarter, or after any GitHub
runtime/platform deprecation announcement)

1. List every pinned action:
   ```
   grep -rE 'uses: [a-zA-Z][a-zA-Z0-9-]+/[a-zA-Z][a-zA-Z0-9-]+@v[0-9]+' \
     .github/workflows/ | sort -u
   ```
2. For each, check the latest released major against the pin via
   `gh release list --repo <owner>/<repo> --limit 5`.
3. **For each candidate version, read the action.yml runtime
   declaration directly** (not the release-note prose). This is
   the authoritative source for "does this action actually run
   on Node N?":
   ```
   gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
     --jq '.content' | base64 -d | grep '^[[:space:]]*using:'
   ```
   Returns e.g. `using: 'node24'` (or `node20`, or `composite`).
   This is the field GitHub Actions reads to pick the runtime.
4. Cross-reference the release notes via
   `gh api repos/<owner>/<repo>/releases/tags/v<N>.0.0 --jq .body`
   for breaking-change context, but treat the notes as
   advisory — see "Release-notes-vs-action.yml trap" below.
5. Pin to the **lowest** new major that satisfies the deprecation
   target AND declares the target Node version in its
   action.yml. The latest major often bundles additional
   unrelated breaking changes — taking the minimum-Node-N major
   lets you adopt those changes deliberately later, not by
   accident.
6. One commit per action class for traceable bisect; push as a
   batch.

### Release-notes-vs-action.yml trap

Release notes describe **intent and feature changes**. action.yml
declares the **actual runtime**. The two can diverge across a
major version when an action adds preliminary Node 24 support
without flipping the default. Always trust action.yml for audit
purposes.

Concrete examples from the 2026-05-14 sweep that caught this:

- **`actions/upload-artifact@v5.0.0`** — release notes said
  *"preliminary support for Node.js 24"* and the bump from v4
  was marked **BREAKING CHANGE**. Both signals pointed at "v5 is
  the Node-24 baseline". But `action.yml` at v5 declared
  `runs.using: 'node20'`. v6 was the actual transition (declared
  `node24`).
- **`actions/configure-pages@v5.0.0`** — release notes talked
  about Next.js breaking changes without mentioning the Node
  runtime at all, leading to inference (from sibling pages
  actions on Node 24) that v5 was Node-24. But `action.yml`
  declared `node20`. v6 added Node 24.

The trap is amplified by the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`
env-var: if it's already in place, runtime tests look green
because the env-var coerces Node 24 regardless of the action.yml
declaration. The action.yml read is the only honest signal.

### Composite-action transitivity

Some actions declare `runs.using: composite` (e.g.
`actions/upload-pages-artifact@v5`). Composite actions don't run
on any Node runtime directly — they wrap calls to other actions.
For those, the audit must read the composite's internal `uses:`
references and check THOSE actions' runtimes:

```
gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
  --jq '.content' | base64 -d | grep 'uses:'
```

Example: `actions/upload-pages-artifact@v5` internally calls
`actions/upload-artifact@v7`, which declares `node24`. So
upload-pages-artifact@v5 is effectively on Node 24 via its
internal dependency — no bump needed at our level even though
its own action.yml says `composite`.

### Difference between "external action" warnings

Two distinct sources of "external" warnings in CI:

- **In-repo action pins**: workflow files reference outdated
  majors. Fixable in `.github/workflows/`. This rule covers them.
- **GitHub-managed services**: e.g. the Dependabot scheduled
  service that's configured under *Settings → Code security →
  Dependabot*, not in workflow files. Annotations from those jobs
  are GitHub's responsibility, NOT the repo maintainer's. Don't
  conflate the two — always grep the codebase to confirm a warning
  has a local source before assuming a fix is locally
  implementable.

### Defensive env-var as a safety net

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` in each workflow's
`env:` block coerces any JavaScript-runtime action declaring Node
20 to run on Node 24. After all our standard-action pins are at
Node-24-native majors, this env-var becomes a **safety net** for
future additions (especially third-party actions that may lag) —
not an active correction. Keep it in the workflow heads; it costs
nothing and prevents reintroduction of the warning when a future
contributor adds an old-major action by habit.

## Module-level caches survive test boundaries (test isolation,
   in-memory edition)

Topos's filesystem and DB test isolation is well-documented
in `CLAUDE.md` ("Test isolation" section) — the `TOPOS_TEST=1`
+ `TOPOS_DATA_DIR` chain plus the production marker tripwire
cover those layers. But **in-memory caches in service modules
have no equivalent guard**, and they survive ALL test boundaries
inside a single pytest process.

The 2026-05-14 platform_schema regression is the canonical
example. `app/services/platform_schema.py` decorates
`load_platform_schemas` with `@lru_cache(maxsize=1)` (intentional
— production wants the YAML read once at startup). The new
`tests/test_platform_schema.py` introduced fixtures that
monkeypatch `_SCHEMA_PATH` to a tmp file with a fake schema and
calls `load_platform_schemas.cache_clear()` once in an autouse
fixture. Symptoms:

- The autouse fixture cleared the cache **before** each test
  but not **after** — `return None` instead of `yield`.
- The fake-schema dict from the last test in the file got
  cached; monkeypatch reverted `_SCHEMA_PATH` at teardown but
  the LRU cache stayed populated.
- The NEXT test file that called the cached loader through its
  real endpoint hit the LRU cache, saw the stale fake dict, and
  five unrelated tests failed with a `ResponseValidationError`
  describing the shape the *previous* test had written.

Caught only in CI (the local pytest invocation in the same
session ran `test_platform_schema.py` in isolation, missing the
cross-file poisoning). Fix: change the autouse fixture from
`return None` to `yield`, and clear the cache on both sides.

### Rule

Any service module that uses module-level mutable state visible
to multiple tests needs a teardown hook in the fixtures that
touch it. Concretely:

- `@functools.lru_cache` decorators → tests that monkeypatch the
  underlying read must `cache_clear()` in BOTH the setup AND the
  teardown of every fixture/test that touches them. The
  `yield`-based autouse fixture pattern is the simplest shape:
  ```python
  @pytest.fixture(autouse=True)
  def _clear_module_cache():
      module.cached_function.cache_clear()
      yield
      module.cached_function.cache_clear()
  ```
- Module-level globals (singletons, registries, dicts assigned
  at import time) → same shape, reset state in both directions.
- Class-level state on a service singleton → same.

### Anti-pattern

Setup-only cache clears (`return None` instead of `yield`) look
correct in isolation — the test file's own tests pass green —
but pytest runs all collected tests in one process. The cache
written by the LAST test in your file is what subsequent test
files see. The bug is invisible inside the file's own boundary,
which is exactly why CI catches it and local single-file runs
don't.

### Detection heuristic

When adding a new test file that fakes out a service module's
inputs, grep that service module for:
```
grep -E '@(lru_|.*_)cache|_cache *=|^[A-Z_]+ *= *' \
  backend/app/services/<module>.py
```

Any match is a candidate for state-survival-across-tests. Either
add the bidirectional `cache_clear()` fixture pattern, or
document why the state is OK to leak (rare, but
``platform_schema``'s `lru_cache(maxsize=1)` IS production
behaviour we wanted, so tests need to isolate, not remove).

### Pairs with

The existing `CLAUDE.md` "Test isolation" section covers
filesystem + DB. This rule covers the third layer: in-process
in-memory state. All three layers need explicit handling.

## Every bug-fix commit ships its regression-pin test

Established 2026-05-14 after the BulkActionBar selection-cleanup
fix (commit 02553fb) shipped with hook-level Vitest coverage but
NO E2E test for the user-facing flow that surfaced the bug.

### Rule

For every bug fixed, the following test coverage is MANDATORY,
not optional:

1. **Regression-pin unit test** at the layer the bug lived in
   (Vitest for frontend, pytest for backend). Asserts the bug's
   specific behaviour is correct. Named to reference the bug. A
   one-line comment in the test references the discovery context.

2. **Integration test if the fix crosses layers.** Frontend
   handler + API client + backend endpoint all exercised; state
   changes verified end-to-end.

3. **E2E Playwright test if the bug was user-facing smoke-
   discovered.** Replicates the exact user flow that surfaced
   the bug. Future-regression-prevention is the load-bearing
   value here.

4. **Cross-surface tests if the bug-class might exist
   elsewhere.** For an Articles bug, verify Books doesn't have
   the same. For a service-worker / routing bug, verify all
   parallel API surfaces have correct routes.

### Stop-condition

If a fix is shipped without the corresponding tests, that is a
**stop condition**: add the tests before closing the commit (or
in an immediately-following commit if the original is already
pushed). Tests don't ride in a follow-up "later" backlog item —
they ride with the fix.

### Retroactive application

When a previous bug-fix is found without regression-pin tests,
file a backlog item to add them. Don't let the gap survive into
the next release.

### Example application (2026-05-14 cycle)

| Bug | Tests shipped |
|---|---|
| BulkActionBar stale state (commit 02553fb) | Vitest hook tests (14 cases) ✓ ; E2E backfilled in a follow-up commit |
| Articles-Trash Restore (reported as SW bug) | Vitest hook tests for trash flow exist ; backend pytest tests pin /restore ; E2E positive regression-pin added (e2e/smoke/articles-trash.spec.ts) |
| Medium-import button state (phase-1 v0.32.0) | 2 Vitest tests pin success + failure paths ✓ |

### Why this rule earns the citation cost

The 02553fb regression — orphan selection ids after row-delete —
shipped to main with a Vitest-only safety net. The fix is correct
but the failure mode it prevents is a user-visible UI bug that
only manifests in a browser, not in a unit test. Without an E2E,
a future refactor (e.g. moving the selection hook into a context
provider, or changing the deletion order) could silently break
the wiring while the unit tests still pass — exactly the bug
class the original fix was meant to prevent. E2E coverage closes
that gap.

## Workbox "No route found" is benign info, not a bug indicator

Established 2026-05-14 after Bug A's user-reported Articles-Trash
Restore-Button "broken" symptom resolved as **not a code bug** —
the restore worked end-to-end; the workbox console message was
misread as causal.

### The trap

Topos's SW config has a single `urlPattern: /^\/api\//`
runtime-cache rule registered for `'GET'` only. **Every non-GET
API call** (every POST, PATCH, DELETE) triggers a Workbox
`No route found for: <url>` console message. **This is
informational — it means "no runtime-cache rule applied,
falling through to default fetch"**, which is exactly the
intended pass-through behavior.

Topos ALSO has `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` in
workflows and SW dev-tools that show precaching-attempt logs for
every API URL. None of those messages indicate an error.

### What an actual SW block looks like

If Workbox were genuinely blocking a request, you'd see:
- The request NEVER appearing in the Network tab (filtered to
  XHR/Fetch).
- A console error like `Failed to fetch` from the application
  code that initiated the request.
- The application code's `.catch()` branch firing.

You would NOT see a successful 2xx response in the Network tab
AND a "No route found" workbox info line — those two together
prove the request DID reach the network and DID succeed.

### Diagnostic recognition pattern

When a user reports "feature X is broken" + cites a workbox
console message as evidence:

1. **Verify the network actually fired**: open Network tab, look
   for the expected request, check its status code.
2. **Verify the backend processed it**: hit the relevant API
   endpoint via curl to check current state.
3. **Cross-check with the parallel feature**: if Books works
   and Articles doesn't, see whether the SW route is actually
   asymmetric in `vite.config.ts` (in Topos's case it's not
   — single rule covers all `/api/*`).
4. **Read the workbox doc text literally**: "No route found"
   ≠ "blocked"; it's "no special handling, default fetch
   proceeds".

### Bug A reframe (the actual 2026-05-14 finding)

Once the workbox red-herring was cleared, the real signal was
the `[Violation] 'click' handler took 419ms` log entry. The
restore worked correctly; it just felt sluggish because
`handleRestore` chains two network roundtrips (`POST .../restore`
+ `GET /articles`) inside a single click handler with `setTrash`
+ `setArticles` synchronous state updates in between. 419ms is
within "perceived as slow" range for UI feedback.

The user-reported "broken" was actually "feels broken due to
perception lag + subtle feedback". Real fix path is optimistic
update + clearer post-restore feedback (filed as
`RESTORE-UX-FEEDBACK-01` in the backlog).

### Rule

When triaging a "feature broken" report that includes a workbox
console message:

- Don't accept the workbox log as bug-causal evidence without
  the corroborating Network-tab + backend-state check.
- Re-frame the symptom: ask "what did the user actually
  observe?" vs "what diagnostic message did the user notice?".
  The two often don't match — users tend to grep the console
  for red-looking text and report that as "the bug".

### Pairs with

The existing "Audit findings need production-vs-dev environment
classification before urgency-tier" rule. Same root cause:
acting on surface-level evidence without verifying against the
authoritative source (in that case, the dev vs prod Docker
config; here, the actual network state).

## Test-isolation discipline: never run integration smoke-tests outside pytest

The Topos harness ships three protective layers against
test runs hitting production data:

1. ``TOPOS_TEST=1`` env-var, set by
   ``backend/tests/conftest.py`` BEFORE any ``app.*`` import.
2. ``TEST_DATABASE_URL=sqlite:///:memory:`` env-var, set in
   the same place.
3. ``.topos-production`` marker file in real data dirs,
   plus a session-scoped autouse tripwire that aborts the
   pytest run with ``returncode=2`` if it ever sees the
   marker.

**All three only fire under pytest.** A free-standing
``poetry run python -c "from app.main import app; ..."``
script bypasses every one of them — conftest never executes
for direct-Python invocations, so the FastAPI app points at
the real production DB at ``~/.local/share/topos/topos.db``.

### Concrete incident

2026-05-16, during Bug 10 Commit 1. A smoke-test of the new
``DELETE /api/comments/trash/empty`` endpoint was run via a
direct ``poetry run python -c "..."`` script (NOT pytest)
against ``TestClient(app)``. The script ran successfully ―
and emptied a real production table, hard-deleting 61
soft-deleted rows in one ``empty_trash`` call. The most recent
backup did not carry that table, so restoring from it was
impossible. (The incident is the sibling project's; the Topos
backup carries Container, Item, Category and Action - the point
is that a backup only protects what its format persists, which
is worth re-checking before trusting one.)

The dev-mode context prevented worst-case impact: the data
was reproducible from the original Medium archive. **But
the discipline violation was real and the harness was
working correctly — the test script ran outside its scope,
not the harness failing.** Frame the incident as a process
breach, not a harness defect, so the project doesn't acquire
a "harness is unreliable" mental model.

### Rule

For any integration smoke-test against FastAPI ``TestClient``
or any code path that imports ``app.main`` /
``app.database`` / ``app.routers.*``:

- **Default**: write the smoke-test as a one-off pytest file
  under ``backend/tests/``. Conftest fixtures (session-scoped
  env-var setup + the marker tripwire) fire automatically.
  This is the right shape for anything more than a single
  trivial assertion.

- **Acceptable shortcut for trivial probes**: prefix the
  command with the env-vars manually:

  ```bash
  TOPOS_TEST=1 TEST_DATABASE_URL=sqlite:///:memory: \
    poetry run python -c "..."
  ```

  Use only when the probe is genuinely a one-line check (e.g.
  "does this import succeed?"). Anything that makes API calls
  or mutates DB state must go through pytest.

- **NEVER**: bare ``poetry run python -c "from app.main
  import app; ..."``. The FastAPI app's lifespan fires
  ``init_db()``, which connects to the production DB via
  ``app.database.DATABASE_URL`` (resolved at import time
  from ``TOPOS_DATABASE_URL`` / ``DATABASE_URL`` env
  vars — neither of which the bare command sets).

### Detection grep

For self-audit before running any one-off probe:

```bash
# Grep your own command history for bare python -c imports.
history | grep -E 'python -c.*app\.main|python -c.*import app'
```

If a hit lacks the ``TOPOS_TEST=1`` prefix, do not run
it. Rewrite as a pytest file.

### Pairs with

- The existing CLAUDE.md "Test isolation" section documents
  the three-layer harness. This rule is the discipline that
  keeps the harness load-bearing — without it, the harness
  exists but isn't exercised on the paths that need it most.
- "Operational gaps masquerade as wired infrastructure" — same
  family. The harness is wired, but only triggered on the
  pytest path; a script outside that path is operationally
  unprotected even though the protection exists.

## Periodic theme-token completeness audit as pre-release hygiene

**Recurring-issue-class observed 2 times across 2 release cycles.**

Topos's theming system uses CSS custom properties
(``var(--token, #hex-fallback)``) for color, spacing, and shadow
tokens. Each token must be defined in all 10 theme variants
(5 palettes × light/dark). When a token is undefined in one
palette, the hex fallback leaks through, producing visually
wrong rendering that's invisible to all UI tests because the
fallback IS a valid color.

### Concrete occurrences

1. **v0.31.0 Pre-Release Audit D3** identified 9 components
   silently falling through to hex when ``--surface-2``,
   ``--danger-bg``, ``--success``, ``--warning`` were undefined
   in some palettes. Fix: added the missing tokens.
2. **2026-05-15 UX-Full-Audit (G4-F4)** inventory:
   ``grep -rhE 'var\(--[a-z-]+, *#' frontend/src/`` returned
   **111 callsites** of the same fall-through-vulnerable pattern.
   Token-vs-palette cross-check not yet performed.

### Rule

**Theme-token completeness audit MUST be part of every
release-cycle pre-release sweep** — alongside ``poetry show
--outdated`` and the test-count verification.

### Audit recipe

```bash
# 1. Inventory every var(--token, #fallback) callsite.
grep -rhE 'var\(--[a-z-]+, *#' frontend/src/ \
  --include='*.tsx' --include='*.ts' --include='*.css'

# 2. Extract the unique --token names referenced.
grep -rhoE 'var\(--[a-z-]+' frontend/src/ \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  | sort -u

# 3. For each --token, check it's defined in all 10 palette
#    × mode combinations in frontend/src/styles/global.css.
#    Missing definitions = the fall-through bug.

# 4. Optionally: add an ESLint rule that flags
#    var(--token, #fallback) usage and require either
#    var(--token) (no fallback — forces existence) OR a
#    documented exception comment.
```

### Pairs with

The existing "Boy Scout rule" + the audit's filed
``THEME-TOKEN-COMPLETENESS-AUDIT-01`` backlog item. Together they
formalize the cadence: ad-hoc fix when an issue fires (the v0.31.0
patch) is reactive; pre-release sweep with the grep recipe above
is proactive.

## User-perceived bug ≠ code bug: the perception-lag class

Surfaced 2026-05-14 when "Articles-Trash Restore button broken"
turned out to be a **419ms click handler with subtle post-restore
feedback**, not a functional failure.

### The pattern

A user reports "feature X doesn't work" or "X is broken" + cites
a console message or symptom as evidence. The diagnostic chain
that follows often surfaces multiple non-bugs before reaching the
real cause:

1. **Surface symptom** the user actually noticed (visual lag,
   missing feedback, console warning).
2. **Diagnostic gut-read** (often workbox messages, network 404s,
   etc.) that look causal but aren't.
3. **Actual cause** which is usually a UX-quality issue, not a
   functional break.

Bug A's progression (2026-05-14):

- User report: "Restore from trash is broken; workbox blocks it"
- Audit: the SW config treats every surface the same; workbox
  "No route found" is benign info, not blocking
- Manual smoke: the restore POST fires, the backend processes it,
  the frontend reloads — the backend confirms the row is back
- **Actual cause**: 419ms click-handler + post-restore feedback
  too subtle (stay-in-trash-view + transient toast + filtered-out
  row vanishing). User-perceived "broken" = user-perceived "lag
  + no clear success signal".

### Rule

**Before patching a code bug, verify the bug is in the code
layer the user thinks it is.** Specifically:

1. **Check the Network tab + backend state FIRST.** If the
   action's backend artifact exists (item restored, container
   created, etc.), the user's symptom is at a different layer.
2. **Console messages are diagnostic clues, not bug citations.**
   Workbox passthrough logs, React StrictMode warnings, and
   browser violation reports often accompany correct behavior.
   Verify the cited message is causal, not coincidental.
3. **Re-frame "doesn't work" as "what did the user actually
   observe?"** vs "what diagnostic message did the user notice?".
   The two often diverge; the second can mask the first.

### The audit-tier output

Perception-lag bugs ARE real UX bugs — they degrade users' trust
even when the code is correct. But they belong in a different
backlog tier than functional regressions: **IMPROVEMENT (UX
performance)**, not BLOCKER. The filed
``RESTORE-UX-FEEDBACK-01`` (P3, optimistic update + post-restore
feedback) is the proper response. Promoting it to BLOCKER would
have made the audit miss the real lesson — which is that
perception is a UX dimension worth fixing, even when nothing is
broken.

### Pairs with

The "Audit findings need production-vs-dev environment
classification before urgency-tier" rule. Same family: separating
"this looks scary" from "this is actually broken" requires
verifying against authoritative sources before urgency-triage.

## Menu-Dialog Lifecycle: do not `preventDefault` inside `onSelect`

Radix `DropdownMenu.Item` (and the sibling `ContextMenu.Item`)
auto-closes the surrounding menu on item-select by default —
that's the desired UX. Calling `e.preventDefault()` inside the
`onSelect` handler suppresses the close. If the handler then
opens a dialog (AppDialog confirm, TypeToConfirmDialog, any
Radix Dialog the parent controls imperatively), the dialog
floats above a still-visible menu — overlapping UI, confused
focus management, and a violation of the "one modal surface at
a time" UX contract.

### Rule

A `DropdownMenu.Item`'s `onSelect` MUST NOT call
`e.preventDefault()` when the handler triggers a dialog. The
default close-on-select is what you want. Let Radix close the
menu; THEN the dialog mounts against a clean stage.

### Why this trap is easy to fall into

Two common mental models lead developers to add the
`preventDefault`:

1. **"I want the menu to stay open while the dialog confirms."**
   A reasonable instinct, but it's the wrong UX contract. Once
   the user picks "Endgültig löschen", the menu's job is done —
   the next decision happens in the dialog. Leaving the menu
   visible behind the dialog adds visual noise and competes for
   focus.
2. **"I'm worried about double-fires or focus-bouncing."**
   Radix handles that internally. The auto-close transition
   precedes the imperative dialog open in your handler, so the
   focus moves from menu trigger → dialog confirm button cleanly.

### Inherited, not yet exercised here

Topos imports no Radix DropdownMenu today (verified: no source
file imports `@radix-ui/react-dropdown-menu`), so this rule is
carried forward for the first menu that does, not describing
existing code. The sibling project's bulk-action bars are the
precedent it came from; the correct pattern is:

```tsx
<DropdownMenu.Item onSelect={() => onBulkDeletePermanent()}>
    Endgültig löschen
</DropdownMenu.Item>
```

No event arg, no `preventDefault`. The dialog opens after the
menu has finished closing. This pattern has been in production
since 2026-04 and works correctly — it's the precedent every
other surface should match.

### Anti-pattern

```tsx
// WRONG — menu lingers around the dialog
<DropdownMenu.Item onSelect={(e) => {
    e.preventDefault();
    onDeletePermanent();
}}>
    Endgültig löschen
</DropdownMenu.Item>
```

Bug 6 (2026-05-16) shipped this anti-pattern across 6 surfaces:
`ArticleCard`, `BookCard`, `BookListView` (the trash + permanent
items), `pages/ArticleEditor` (reclassify), `Toolbar` (Copy
split-button items), `pages/Dashboard` (theme toggle). The fix
in commit `02fc66b` simplified each callsite to
`onSelect={() => handler()}`.

### Detection recipe (automatable)

```bash
grep -rnE 'onSelect.*e\.preventDefault|onSelect=\{?\(e\)' \
  frontend/src/components/ frontend/src/pages/ \
  --include='*.tsx' --include='*.ts'
```

Any match outside of a clearly-justified case (e.g. a Copy
menu where the user *intentionally* wants the menu to stay
open for a follow-up copy-action AND the handler does NOT
trigger a dialog) is a Bug-6 regression candidate. Future
audits can wire this grep into a pre-commit hook or a CI
check; the fix is mechanical (remove `preventDefault`, drop
the `(e) =>` wrapper) and the regression-pin lives in
`e2e/smoke/menu-dialog-close.spec.ts`.

### Exceptions

The rule covers `onSelect` handlers that **trigger dialogs**.
The same `preventDefault` call would be the *right* answer in
narrowly-scoped cases where you legitimately need Radix to NOT
auto-close — for example:

- An "advanced options" sub-flow where the menu stays open
  while a popover-style inline panel expands beneath the
  item. (Not currently used in Topos.)
- A multi-step picker where each click reveals another tier
  of the same menu. (Use Radix `DropdownMenu.Sub` instead —
  the composed sub-menu has the right semantics natively.)

If you're about to add `preventDefault` for any other reason,
the answer is almost always that you want a different Radix
primitive (Sub, Popover) — not a workaround.

### Pairs with

- "Radix DropdownMenu + happy-dom is brittle for Vitest" —
  the reason this rule's regression pin lives in E2E
  (`e2e/smoke/menu-dialog-close.spec.ts`), not Vitest.
- "Split-button (default + chevron disclosure) for primary +
  alternative outputs" — the Toolbar Copy split-button is one
  of the Bug-6 surfaces; the fix preserves the split-button
  pattern while removing the lingering-menu UX smell.

## New-hook + new-mock-key contract drift in EXISTING test files

When a feature introduces a new hook (or new API client method,
or new behavior that depends on a mocked API), the new hook's
data contract is fresh — but the EXISTING test files that mock
that API are not automatically aware of it. If the existing mocks
return a response shape that doesn't include the new key/field
the new hook reads, the hook silently falls back to its hardcoded
default and consumer tests in those existing files assert against
the wrong state.

### Concrete incident

Bug 3 (2026-05-16, commit `5767289`) shipped a new
`useTrashViewMode` hook that reads
`ui.dashboard.articles_trash_view` from the mocked
`api.settings.getApp()` response. The companion test commit
(`8cf6ed0`) added an "AD-Trash view-mode default" test inside
the EXISTING `ArticleList.test.tsx`, but the existing
`vi.mock("../api/client", ...)` block was returning only
`{articles_view: "list"}`. The new hook looked for
`articles_trash_view`, found nothing, kept its hardcoded
`"grid"` initial state, and the test's "list visible by default"
assertion failed. The red was invisible at commit time of
`8cf6ed0` (we don't know whether the test author ran the full
suite then) and stayed red on `main` for 24+ hours until the
follow-up session's `make test` surfaced it. Fix (Bug 7,
2026-05-16, commit `5728e71`) extended the mock to include
`articles_trash_view: "list"`.

### Rule

When introducing a new hook or new API consumer that reads from
a key of an already-mocked API response, do BOTH of these in
the same commit:

1. **Grep every test file that mocks the same API** and verify
   the mock's return value includes the new key. Recipe:

   ```bash
   grep -rn 'vi\.mock.*api/client\|getApp:\s*vi\.fn' \
     frontend/src --include='*.test.ts*' \
     --include='*.test.tsx'
   ```

   Or, scoped to the specific API method:

   ```bash
   grep -rn '<METHOD_NAME>:\s*vi\.fn\|<METHOD_NAME>(' \
     frontend/src --include='*.test.*'
   ```

2. **Run the FULL `make test` before commit-time green-claim**,
   not just the targeted file you just wrote. A new hook
   transitively touches every file whose consumers render it;
   targeted-only verification misses cross-file failures.

### Why this trap is easy

The new test the author writes for the new hook is green —
they mock what the new hook reads. But the *existing* test
file (the one that's been working for months) keeps its old
mock. The author often doesn't think to revisit it because
"that test doesn't touch the new feature." It does, transitively,
via the shared component (here, the `ArticleList` page renders
both `useViewMode` and the new `useTrashViewMode` simultaneously).

### Pairs with

- The CLAUDE.md "make test must stay green after every change"
  rule is the parent discipline; this rule is the concrete
  failure mode that violates it most quietly.
- "End-to-end behavior tests are not 'kwarg passes through'
  tests" — both rules pin "test the OBSERVABLE OUTPUT through
  the full component tree", not just the new code's inputs.

## Integrating a storage-agnostic kit: implement the adapter seam, don't fork the UI

Replacing Topos's hand-rolled AI provider config (provider preset
mirror, plaintext-localStorage key store, ~415-LOC settings form)
with the ``@astrapi69/ai-key-vault`` kit (core + ``-react`` +
``passphrase-vault``) confirmed a clean shape for adopting a
"bring your own storage / bring your own design system" library:

- **The kit ships a storage SEAM, not storage.** ``AiKeyStoreAdapter``
  is an interface the app implements over whatever persistence it
  already has. Topos ships TWO adapters behind one UI: a backend
  adapter over ``/api/settings/*`` (keys server-side, write-only,
  ``clientReadableKeys: false`` so the encrypted export is hidden)
  and a local adapter over a passphrase-encrypted browser vault
  (``clientReadableKeys: true``). The panel is identical; only the
  adapter + the ``browserRuntime`` flag differ. Do NOT fork the UI
  per mode — inject the adapter.

- **The kit's UI takes design-system SLOTS.** ``AiSettingsProvider``
  accepts ``Button`` / ``Input`` / ``Link`` / ``notify`` / ``confirm``
  / ``t``. Map them onto the app's own primitives
  (``ui/classes`` + react-router ``Link`` + ``useDialog`` +
  ``useI18n``) and define the slot components at MODULE level so their
  identities stay stable across renders (a fresh ``Input`` identity per
  render remounts and blurs the field).

- **Provider ids are DATA; keep the app's ids, don't inherit the
  kit's.** The kit's built-ins use id ``gemini``; Topos's backend
  chain, ``/settings/ai/*`` and the vision client all key on
  ``google``. Building the registry via ``createProviderRegistry`` with
  explicit descriptors (ids ``anthropic``/``openai``/``google``) avoided
  a translation layer at every boundary. Same reason to keep explicit
  ``corsBlocked`` flags instead of the built-ins' defaults: Topos
  deliberately gates openai/google behind the backend in browser-direct
  mode, and the built-in descriptors set no ``corsBlocked`` at all.

- **What the kit does NOT ship, the app still owns.** The kit's 0.1.x
  panel has no base-URL field (so the custom OpenAI-compatible provider
  was dropped — it stays backend-YAML-only until upstream adds the UI)
  and no "AI enabled" toggle (a Topos concept, kept as a wrapper-level
  checkbox writing ``ai.enabled`` / vault metadata). Audit the packaged
  UI's actual rendered fields (grep the dist for ``data-testid`` +
  the props it reads) BEFORE assuming a data-model field is editable —
  ``baseUrlOverride`` is in the snapshot TYPE but no input renders it.

## At-rest encryption needs an unlock SESSION the export/import vault doesn't provide

The ``passphrase-vault`` primitive (PBKDF2 + AES-GCM) and the kit's
``.alk`` key-vault io are built for device-to-device EXPORT/IMPORT: a
passphrase per file operation. "No plaintext keys in localStorage"
(at-rest encryption) is a DIFFERENT requirement and the kit does not
ship it. There is no middle ground: a key that must be USABLE without a
prompt cannot also be encrypted at rest (the passphrase would have to be
stored, defeating the point). So encrypting keys at rest necessarily
means an in-memory unlock SESSION:

- ``localVaultStore`` keeps the keys only as a ciphertext envelope in
  localStorage; ``unlock(passphrase)`` decrypts into memory for the tab
  session; the passphrase is never persisted; ``lock()`` clears it.
- A plaintext, secret-free METADATA mirror (enabled flag, active
  provider, model/base-URL overrides, a per-provider *has-key* boolean)
  lets the locked UI and the photo-intake gate reflect state WITHOUT a
  passphrase. The metadata carries zero key material (regression-pinned:
  a test asserts the serialized metadata never contains a key).
- Consequence for every downstream AI gate: a stored key is only usable
  after an unlock this session. ``PhotoIntake`` therefore treats "ready"
  as ``resolveActiveProvider() !== null`` (which requires the unlocked
  session), and a page reload requires re-unlocking. This is the
  accepted tradeoff for at-rest encryption, and the reason the decision
  to encrypt was made explicitly with the user first.
- The at-rest envelope and the exportable ``.alk`` file share ONE format
  string (``topos-ai-keys``), so a vault exported on device A imports on
  device B; a foreign app's envelope is rejected on decrypt.

Verification note: ``crypto.subtle`` (WebCrypto) works under
happy-dom + Vitest on Node 22, so the vault store + the create/unlock
gate lifecycle are testable in the normal frontend suite — no
node-environment carve-out needed.

## A packaged UI renders its OWN i18n fallbacks; catalog translation only reaches backend-fetched locales

``useI18n`` fetches the whole catalog from ``GET /api/i18n/{lang}`` and
``t(key, fallback)`` returns the inline fallback when the fetch fails or
the key is missing. Two consequences when swapping in a packaged UI:

- In the no-backend PWA mode the catalog fetch fails, so EVERY string
  (Topos wrapper AND the packaged panel) renders its inline/kit
  fallback. The kit's fallbacks are English, so the local-mode panel is
  English regardless of what the YAML catalog contains. Only
  backend-mode users get catalog translations.
- Therefore adding the kit's ~44-key namespace to ``de.yaml`` only helps
  backend-mode German users and was deferred; the Topos-owned wrapper
  keys (the vault gate) WERE added to all 8 catalogs. When adopting a
  packaged UI in a catalog-fetched i18n system, budget the kit's own key
  namespace as a separate translation task and be explicit that
  local/offline mode always shows the kit's shipped fallbacks.

---

# Topos-specific lessons (this project's own history)

The lessons above are the generalizable ones (backend/Alembic, test
isolation, version pins, CI, Vite/TS, i18n, Radix/happy-dom, the
storage-agnostic AI-key-vault kit). The cluster below is Topos's own,
learned building the inventory tracker + its GitHub Pages PWA.

## Base path: apiBase + PWA config MUST respect import.meta.env.BASE_URL

The GitHub Pages PWA is served under `/topos/`, not `/`. Anything that
builds a URL from a hardcoded `/api` or `/` breaks there. `apiBase()`
must be `${import.meta.env.BASE_URL}api` (so it targets `/topos/api`);
the health probe, the vite-plugin-pwa `scope`/`start_url`, and the
service-worker `navigateFallback` all take the base too. A stale-deploy
class of bug ("changes don't land on GH Pages") was actually the SW
serving old precached assets - switched `registerType` to `autoUpdate`
so a new deploy self-heals. Rule: every URL in the frontend flows
through a base-aware helper; never a bare `/api` or `/`.

## GitHub-Pages deploy can fail on transient GitHub infra - verify the LIVE bundle

The `deploy-gh-pages.yml` run failed twice with "Failed to resolve
action download info. Error: Service Unavailable" at Set-up-job - a
GitHub Actions outage, not a code bug. The build never ran, so the fix
never went live and the user still saw the old app. Re-dispatch when
infra recovers. ALWAYS confirm a deploy actually shipped by fetching the
live bundle and grepping the Settings/index chunk for a marker you just
added (`curl .../assets/Settings-*.js | grep <new-testid>`), rather than
trusting a green run or assuming the push deployed.

## Reproduce a reported UI bug in a real browser before concluding "by design"

The "AI providers not visible on GH Pages" report was dismissed three
times as "works as designed (passphrase gate first)" from reading code.
It was a real UX wall. Only a real-browser reproduction found it. Recipe:
`GITHUB_PAGES=true VITE_STORAGE_MODE=dexie npm run build` then
`vite preview`, drive `http://localhost:PORT/topos/<route>` with a
Playwright script that lives IN `e2e/` (so `@astrapi69/... `/`@playwright/test`
resolve; a /tmp script fails ERR_MODULE_NOT_FOUND). A repeated report
falsifies the prior "by design" - re-open, do not re-defend. See
[[reproduce-ui-bugs-in-browser]].

## AI in the browser: corsBlocked providers are backend-only

Only Anthropic ships the `anthropic-dangerous-direct-browser-access`
opt-in, so it is the only provider callable straight from the browser in
dexie mode. OpenAI / Google / Perplexity are `corsBlocked: true` in
`src/ai/registry.ts` (and the kit's `PERPLEXITY_PROVIDER`) - they need a
backend proxy. Do NOT offer a browser-direct call a CORS policy will
reject; mark such providers desktop/backend-only in the UI. Perplexity
is OpenAI-compatible, so its backend vision call reuses the openai path
(`vision.py` else-branch, `recognize_openai(provider="perplexity")`) -
no new client.

## Lazy passphrase: show the provider list, ask the passphrase on first key save

Gating the whole AI provider panel behind "create a passphrase first"
reads as "no providers here" and generated repeated bug reports. In
local mode the panel is ALWAYS visible; the passphrase is requested
lazily, only when the first key is saved (the adapter's `ensureUnlocked`
seam). At-rest encryption still holds (keys never stored plaintext), but
the in-memory unlock session clears on reload, so any AI-gated feature
(PhotoIntake) must (a) treat "vault locked" as a distinct, actionable
state and (b) tell the user to unlock in Settings - not a generic "needs
AI settings" hint. See [[ai-features-follow-adaptive-learner-pattern]].

## Passphrase fields: SecretInput, never `<input type="password">`

A password input triggers the browser/OS password manager (autofill
popup, "save password?") and hides the value with no reveal - wrong for a
vault passphrase the user wants to see and that no password manager
should capture. `components/SecretInput.tsx` renders `type="text"` +
`-webkit-text-security` mask + `data-1p-ignore`/`data-lpignore`/
`autocomplete="off"` + a show/hide toggle. (The kit's own `SecretInput`
needs the AiSettings context; this standalone twin works in the
passphrase modal that renders outside the provider.) happy-dom drops the
vendor `-webkit-text-security`, so test the reveal via the toggle's
`aria-label`, not the style attribute.

## Cross-test async can write module-level state after the next beforeEach

A create-form validation test asserted `vault.hasVault() === false`, but
a prior test's still-pending vault write (the in-memory `localVaultStore`
is module-level) landed after that test's `beforeEach` cleared
localStorage, flipping the global. `beforeEach` was clean (envlen 0); the
write came mid-test. Fix: assert the LOCAL proof (`onReady` not called -
it fires only after a successful `createVault`), not a pollutable global.
Generalises the "module-level caches survive test boundaries" rule to
async writes, not just `lru_cache`.

## Tailwind purge: template-literal + arbitrary classes need help

Tailwind's content-glob only sees class strings that appear literally in
the `.tsx`. Classes composed in a template literal (`` `${base} ...` ``)
or shared via `ui/classes.ts` string constants are found only because the
literal fragments are present; a class assembled dynamically at runtime is
purged. Arbitrary-value utilities (`min-h-[44px]`) are generated from the
literals in the components. Rule: keep class strings literal (or in
`ui/classes.ts`), never build a class name by concatenating variable
parts; if you must, safelist it.

## Browser-direct AI is a per-endpoint CORS fact, measure it -- never guess

Topos's AI vision recognition runs two ways: backend mode (`POST
/api/ai/vision`, key server-side, no CORS issue) and offline PWA mode
(browser-direct fetch to the provider's own API). Which providers work
browser-direct is a hard CORS fact per endpoint, and the registry's
`corsBlocked` flag encodes it.

The flags were originally **guessed**: an early note assumed "only
Anthropic ships the `anthropic-dangerous-direct-browser-access` opt-in,
so it is the only browser-direct provider" and marked openai/google/
perplexity/custom `corsBlocked: true`. That guess built two silent bugs:
google and perplexity showed a false "Nur Desktop" label and had their
Test button disabled in the offline PWA, even though their APIs allow
the browser-direct call. The user's symptom was "warum nur Anthropic?".

An empirical probe settled it. Load a page on the **real deployment
origin** (here `https://astrapi69.github.io/topos/`, so the browser
evaluates CORS exactly as the PWA does), then `fetch` each provider's
**actual** endpoint with a dummy key and observe reached-vs-blocked:

```js
// Playwright: await page.goto(liveOrigin); await page.evaluate(async () => {
//   try { const r = await fetch(url, opts); return {reached:true, status:r.status}; }
//   catch (e) { return {reached:false, error:String(e)}; } })
```

Results (dummy keys -> a 400/401 means the request REACHED the server;
"Failed to fetch" means CORS-BLOCKED):

| Provider   | Probed call                    | Result            | browser-direct |
|------------|--------------------------------|-------------------|----------------|
| anthropic  | GET  /v1/models                | 401 reached       | YES            |
| google     | POST .../v1beta/...:generateContent | 400 reached  | YES            |
| perplexity | POST /chat/completions         | 401 reached       | YES            |
| openai     | POST /v1/chat/completions      | Failed to fetch   | NO             |

Two traps the probe exposed:

1. **Test the endpoint you actually call, not a proxy for it.** OpenAI's
   `GET /v1/models` reaches (401) -- a naive "test connection" against
   /models would report OpenAI as browser-callable. But the real vision
   call, `POST /v1/chat/completions`, is CORS-blocked. GET reaching does
   NOT imply POST reaching; different endpoints have different CORS
   policies on the same host. Probe the exact method+path production uses.
2. **The flag is cosmetic-until-wired.** In this codebase `corsBlocked`
   only drove the kit's status label + Test button; the recognition
   dispatch (`recognizePhotoDirect`) never gated on it, so google/
   perplexity recognition would have *run* -- the flag just lied in the
   UI. When a capability flag exists, know whether it actually gates the
   capability or only decorates it; a wrong decorative flag still erodes
   trust ("it says Desktop only, so I didn't try it").

Fix: `corsBlocked: false` for google and perplexity (override the kit's
`PERPLEXITY_PROVIDER`, which ships it `true`), keep `openai` and `custom`
`true`. OpenAI genuinely cannot run browser-direct -- its chat endpoint
sends no CORS headers -- so offline it needs the backend/desktop app.
That is OpenAI's restriction, not a Topos bug; do not paper over it by
flipping the flag, and do not claim "all providers work offline" when one
provably cannot. Pin the whole matrix in a test
(`registry.test.ts::marks browser-direct providers per the empirical CORS
matrix`) so a future edit that re-guesses fails loudly.

Generalises: any "can I call X from the browser?" question is answerable
in 30 seconds with a real-origin fetch probe. A guessed CORS flag is a
bug with a UI. Measure, then encode, then regression-pin.

## "No artifacts named github-pages" is a GitHub flake, not a build bug

Twice on 2026-08-12 the Pages deploy failed with:

```
Fetching artifact metadata for "github-pages" in this workflow run
Found 0 artifact(s)
##[error]No artifacts named "github-pages" were found for this workflow run.
```

It reads like the build produced nothing, and the temptation is to go
hunting through `vite.config.ts` or the workflow's `path:`. Do not: check
the upload step first. In both cases it had plainly succeeded seconds
earlier —

```
Run actions/upload-pages-artifact@v5 ... Uploaded bytes 1589685
```

— and `deploy-pages` simply could not see the artifact metadata yet. The
action's own error text says as much ("Is githubstatus.com reporting
issues with API requests, Pages, or Actions?"). It is a propagation race
inside GitHub, and the second occurrence came with runs sitting `queued`
for minutes, i.e. a congested Actions backend.

Remedy: `gh run rerun <id>`, and if runs are queueing, wait for the
platform rather than pushing a "fix". Nothing in the repo changes.

Diagnostic that separates the two cases in one command:

```bash
gh run view <id> --log | grep -iE "Uploaded bytes|Found 0 artifact"
```

Bytes uploaded + 0 artifacts found = platform. No upload line at all =
our problem (wrong `path:`, empty `dist/`, a build that failed silently).

Pairs with the earlier "GitHub-Pages deploy can fail on transient GitHub
infra" note: same family, different symptom - that one failed at
Set-up-job while resolving actions, this one after a successful upload.
Both are re-run-and-verify, never re-architect.

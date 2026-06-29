# Vibe coding rules

Short, always-applicable rules for working in this codebase with an AI
assistant. They make AI-assisted work land on the existing patterns
instead of reinventing them.

## Per-task rules

1. **PROMPT PRECISION**: reference existing patterns (the storage
   abstraction, the repository pattern, PluginForge hooks, the error
   chain) instead of inventing new ones. Name the file, the function, the
   expected behaviour.

2. **LAYERED ARCHITECTURE**: no business logic in components, no DB
   queries in routers, no direct `fetch` calls. Dependency direction:
   Router -> Service -> Repository -> Models (see `architecture.md`).

3. **TESTS**: every behaviour change needs tests (see `tdd.md`).
   Data-integrity changes (backup/restore, migrations) additionally need
   the manual round-trip acceptance gate in `quality-checks.md`.

4. **DEPENDENCIES**: no new dependency without a manual check of
   maintenance status and security. Prefer an existing dependency
   (see `reusability.md`).

5. **REFACTORING**: split god-files, do not whitelist them. A whitelist
   entry is only for single-concern files (models, schemas, static data).

6. **GIT**: issue FIRST (see `ai-workflow.md`), reference it in the
   commit (`Closes #NN`). Docstrings over inline comments. One concern
   per PR.

## Priority order (fixed, not negotiable)

1. Merge open PRs
2. P0/P1 bugs
3. Infrastructure (CI, security, guards)
4. UI fixes
5. Cleanup/refactoring
6. Features
7. Release

Foundation before features. Measure first, then harden.

## Release freeze

Once a release branch is cut (`release/X.Y.Z` exists), until the release
is tagged and published:

- No new PRs against the development branch
- No merges into the development branch
- No new code, only the release workflow
  (release-test, release-finish, release-publish)
- Exception: a P0 hotfix that blocks the release itself

Tag first, then keep working.

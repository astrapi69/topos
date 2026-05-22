# Next session opener (pluginforge-app-template, 2026-05-21+)

Read [docs/journal/handover-2026-05-21.md](../../docs/journal/handover-2026-05-21.md) first for the full state snapshot.

## Quick orientation

- `main` is at `0c89479` (merge of PR #3, v0.10.0 adoption).
- Template now runs on PluginForge v0.10.0; the `manager._app_config = ...` hack has been replaced everywhere with `config_overlay.refresh_manager_overlay()` wrapping `manager.merge_app_config()`.
- `make test`: 1278 passed, 1 skipped (baseline preserved).

## Standing decision waiting for you

**Deploy Docs CI workflow has never succeeded** on this template. Every run since the initial commit (2026-05-17) failed with the same error: `scripts/generate_mkdocs_nav.py` can't find marker pairs in `mkdocs.yml`.

Three scopes proposed:

1. **Minimum**: insert the marker pairs around the existing content, regenerate via the script, commit. If output matches current nav -> trivial PR. If it differs -> surface the diff.
2. **Audit-first** (recommended): run the script locally now, diff the generated `mkdocs.yml` against the current one, report what would change before any commit.
3. **Defer**: file a tracking issue, leave the workflow failing, pair with the next docs-site work.

Pick a scope and I'll execute. If you have no preference, default to **audit-first** - it's the lowest-risk path.

## Session-start checklist

Per `.claude/rules/ai-workflow.md`:

1. Read `docs/ROADMAP.md` (if absent, skip).
2. `git log --oneline -10` for recent context.
3. `make test` for a green baseline (expect 1278 passed, 1 skipped).
4. Read this prompt + the linked handover.

# Next-session kickoff prompt

Paste this verbatim into a fresh Claude Code session at the
Topos repo root. The prompt is self-contained; the rest of the
context lives in `docs/handover.md` and `CLAUDE.md`.

---

You are continuing work on **Topos**, a personal inventory
tracker for physical storage (folders, boxes, items, categories,
actions). The eight-phase project bootstrap is complete; HEAD is
`df61224` ("chore: final sanity sweep, all checks green").

## Before doing anything else

1. Read `docs/handover.md` end-to-end. It documents current
   state, the codebase map, environment gotchas, hard
   constraints, and open follow-ups.
2. Read `CLAUDE.md` for the project conventions (test
   isolation, secrets chain, ruff/pre-commit gates, etc.).
3. Read `docs/ROADMAP.md` for the prioritised open work.
4. Skim `.claude/rules/architecture.md` and
   `.claude/rules/coding-standards.md` for the layering rules
   and Python/TS style conventions Topos inherits from the
   template lineage.

## Verify the green baseline before starting

```bash
unset VIRTUAL_ENV POETRY_ACTIVE

(cd backend && PYTHONPATH=. poetry run pytest --no-cov -q tests/)
# expect: 319 passed, 1 skipped

(cd plugins/topos-plugin-excel-import && \
    PYTHONPATH=$(pwd)/../../backend \
    $(pwd)/../../backend/.venv/bin/pytest -q tests/)
# expect: 27 passed

(cd frontend && npm run test)
# expect: 90 passed across 18 files

(cd frontend && npx tsc --noEmit)
# expect: clean (empty output)
```

If any command fails, stop and investigate before touching
anything. The baseline was green at `df61224` (see commit chain
in `docs/handover.md` section 2).

## Hard constraints (do NOT violate without asking)

- **No AI features.** Phase 3 of the bootstrap deliberately
  deleted the template's `app/ai/` module, voice store, and
  audiobook infrastructure. Do not reintroduce them.
- **No new npm dependencies.** Work with what
  `frontend/package.json` already has (Radix UI, Dexie, Lucide,
  react-toastify, dnd-kit, etc.). If you genuinely need
  something else, flag it and wait for approval.
- **Backend is the single source of truth.** Dexie is a
  read-through cache only. No offline mutation queue, no CRDT.
- **German content uses real umlauts** (ä ö ü ß).
- **No em-dashes** (U+2014) in Topos-authored code or docs.
  Use hyphens or commas.
- **Routers stay thin.** Services raise `ToposError`
  subclasses; routers catch nothing; the global handler in
  `main.py` maps to HTTP.
- **No CWD-relative paths.** Use `app.paths.get_*_dir()` helpers.
- **Do not edit `.claude/rules/lessons-learned.md`** to "prune"
  template-era entries. Leave it as-is until Topos accumulates
  its own incident history.
- **Do not edit `docs/prompts/Topos-Bootstrap-Prompt.md`**. It
  is a frozen historical artifact.

## Environment quirks to know

- Shell may set `VIRTUAL_ENV=/usr` which poisons poetry. Always
  `unset VIRTUAL_ENV POETRY_ACTIVE` before `poetry install` or
  `poetry run`.
- In-project venvs live at `backend/.venv/` and `launcher/.venv/`.
- Plugin tests run inside the backend venv, not the plugin's
  own venv (the plugin is path-installed into the backend).
- Pre-commit hooks reformat files mid-commit. If a commit
  silently doesn't land, files were auto-fixed and the commit
  aborted; re-stage with `git add -A` and retry.
- The `plugin-lock-paired-with-pyproject` hook requires staging
  `plugins/topos-plugin-*/poetry.lock` whenever the matching
  `pyproject.toml` is staged.

## Workflow

After verifying the baseline, ask the user what to work on. The
likely first pick is one of these P2 items from
`docs/ROADMAP.md`:

- TypeScript port of `astrapi69/tree-api` + `astrapi69/gen-tree`
  (a separate handover doc may exist for this)
- QR-label-print plugin
- Photo-attachment plugin
- PWA installability hardening
- Desktop-launcher build pipeline verification

For any non-trivial task: write a short plan, get user
agreement, then execute in atomic green commits. Conventional
Commits style. One feature = one commit unless the user says
otherwise.

If the user says "continue" or "next item", they mean: name the
first open item in `docs/ROADMAP.md` and wait for confirmation.
Do NOT start implementing on bare "continue" without naming the
target first.

When in doubt, follow the rule from the bootstrap prompt:
**STOP and ask** rather than guess.

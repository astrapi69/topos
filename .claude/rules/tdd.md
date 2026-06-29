# Test-Driven Development (TDD)

This is the WORKFLOW rule for writing code. It sits on top of the test
STRATEGY in `quality-checks.md` (pyramid, coverage targets, mutation
testing) and the test bullets in `coding-standards.md` ("failing test
FIRST, then fix"). Where those state *what* and *how much* to test, this
rule states the *order*: test first, then the minimal code, then cleanup.

## Mandatory for code changes with logic

Code changes that introduce behaviour/logic follow the Red-Green-Refactor
cycle. "With logic" means: a new behaviour, a changed code path, a
condition, a calculation, a validation, a mapping. Pure mechanics with no
behaviour change fall under the exceptions below.

### Phase 1: RED (test first)

- Write a test that describes the desired change.
- The test MUST fail (proves the feature/fix does not exist yet).
- No production code before the failing test.

### Phase 2: GREEN (minimal implementation)

- Write only the code that makes the test green.
- YAGNI: no premature optimisation, no code "for later"
  (mirrors `ai-workflow.md` "only what is needed now").
- `tsc --noEmit` + vitest (frontend) and pytest (backend) green.

### Phase 3: REFACTOR (clean up)

- Improve code smells, duplication, naming (Boy-Scout rule,
  `coding-standards.md`). Tests stay green.

## How many tests per feature/fix

The minimal floor in `quality-checks.md` ("New service or new function:
at least a happy path + one error case"; "New endpoint: at least one
happy-path test") is the FLOOR for trivial cases. For a real feature or a
fix the TARGET is the breakdown below — at least four tests that together
pin the behaviour:

1. **Reproduction test** — the Red test before the fix/feature.
2. **Happy path** — the expected normal case.
3. **Edge cases** — empty/missing/unexpected inputs.
4. **Boundary** — the edges of the valid range.

Floor (happy path + error case) and target (4-way breakdown) are NOT a
contradiction: the floor is for trivial new functions, the target is for
features and fixes. More tests are allowed, fewer than the floor is not.
No artificial tests just to hit a count — every test asserts a real
behaviour property ("Meaningful coverage is the goal", `quality-checks.md`).

## Bug fixes

- ALWAYS write a test that reproduces the bug FIRST (RED, proves the bug).
  This is the workflow form of "Bug fixes: failing test FIRST, then fix"
  from `coding-standards.md` / `quality-checks.md`.
- Then fix until GREEN.
- The reproduction test stays in the repo as a regression guard.
- Matches root-cause discipline: make the bug reproducible first, then
  fix — no fix without an understood cause.

## Exceptions

TDD is NOT enforced for:

- Pure documentation changes (no code).
- Pure configuration (CI, Makefile, YAML) with no logic.
- Mechanical refactors with existing test coverage: file splits,
  barrel/re-export moves, god-folder breakups, schema/type generation.
  Here the existing suite MUST stay green (proves nothing broke), but no
  new behaviour tests are forced.
- Visual / device-only aspects that are not testable in a container stay
  a manual remainder — TDD replaces neither the Visual Device Check nor
  the acceptance gates in `quality-checks.md`; it complements them.

The exceptions do not relax the hard rule "`make test` must stay green
after every change".

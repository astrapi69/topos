# Reusability rules

Reusable building blocks should read like reusable building blocks: no
hidden coupling to one app's domain, no import-time side effects, a clear
seam for callers.

- **Props-driven**: all data/callbacks flow in via props or seams.
- **No side effects on import** (a module import must not start work,
  hit the network, or read app state).
- **Barrel exports** (`index.ts` / `__init__.py`) at module boundaries.
- **Generic naming** (`MatchingTile`, not `ToposMatchingTile`).
- **Token-backed styling** — no fixed-palette utility classes, no
  hardcoded colours (see `design-tokens` pattern when adopted).
- **App-independent reusable parts** live in a dedicated `shared/`
  directory (`frontend/src/shared/`), free of app-specific imports.
- **TSDoc / docstring with a usage example** is mandatory for shared code.
- **App-specific state only via props**, never imported directly.

## Implementation hierarchy (Language -> Framework -> Library -> Self)

Before writing a new utility, walk the hierarchy top-down and STOP at the
first level that fits:

1. **Language/runtime first** (native APIs, zero bundle cost):
   JS/TS `Intl`, `crypto.subtle`, `URL`, `fetch`, `structuredClone`,
   `Array`/`Set`/`Map`, `IntersectionObserver`; Python `pathlib`,
   `dataclasses`, `json`, `hashlib`, `functools`, `unicodedata`.
2. **Framework** (what is already here): React hooks/context, Vite
   `define`/`import.meta.env`, FastAPI `Depends`/`BackgroundTasks`.
3. **Library** (npm/PyPI, only when 1+2 do not suffice): an existing
   dependency before a new one; a new one must be actively maintained
   (recent release, healthy download count), small relative to the LOC it
   saves, and free of known CVEs.
4. **Write it yourself** (only when 1-3 do not fit): library-grade (no
   app imports, own types, TSDoc), cohesive (one concern, well under
   ~500 lines), complexity cc < 20, with its own tests; the PR documents
   WHY it was built (which level, what reason).

This complements the dependency rule in `coding-standards.md` ("new
dependencies only after asking"): the hierarchy is how you decide whether
a dependency is even warranted before proposing one.

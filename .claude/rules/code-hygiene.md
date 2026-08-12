# Code hygiene

Automated enforcement of code quality. These rules make every commit look consistent, whether written by a human or an AI.

## Formatting and linting (automatic)

### Python (Backend + Plugins)

```toml
# backend/pyproject.toml

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "N",    # pep8-naming
    "UP",   # pyupgrade
    "B",    # flake8-bugbear
    "SIM",  # flake8-simplify
    "TCH",  # flake8-type-checking
]
ignore = [
    "E501",  # line-length (handled by the formatter)
]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

**Commands:**
```bash
cd backend && poetry run ruff check .         # lint
cd backend && poetry run ruff check --fix .   # auto-fix
cd backend && poetry run ruff format .        # format
```

### TypeScript (Frontend)

ESLint 10 with flat config (`frontend/eslint.config.js`). Correctness
only - Prettier owns formatting and runs as its own hook, so the linter
carries no style rules.

- `typescript-eslint` (the meta-package: parser + plugin in one import)
- `eslint-plugin-react-hooks` v7
- Project rules: `no-explicit-any` and `no-unused-vars` (with `^_`
  escape) as errors, `no-console` allowing only `warn`/`error` - user
  feedback belongs in toasts.
- Tests relax `no-explicit-any` and `no-console`: casts and throwaway
  shapes there are not the same defect they would be in production code.

react-hooks v7 bundles the React Compiler checks. `rules-of-hooks` stays
an error; the compiler-era rules (`set-state-in-effect`, `refs`,
`preserve-manual-memoization`) report a preferred shape rather than a
defect and this codebase predates them, so they are warnings - visible,
not blocking. Work them off file by file, then raise the clean ones back
to error.

Type-aware linting (`recommendedTypeChecked`) is deliberately off: it
needs a full program per run, and `tsc --noEmit` already covers types.

**Commands:**
```bash
cd frontend && npm run lint        # eslint src
cd frontend && npm run lint:fix    # eslint src --fix
cd frontend && npx prettier --write src/
cd frontend && npx tsc --noEmit
```

Prettier's settings live in `frontend/.prettierrc`; do not restate them
here - a second copy is a second source of truth.

### Setup (one-time)

```bash
cd backend && poetry add --group dev ruff
cd frontend && npm install   # eslint + prettier are devDependencies
```

---

## Pre-commit hooks

The live list is `.pre-commit-config.yaml` - read it there rather than
from a copy here, which only ever drifts. As of this writing the chain
is: whitespace / EOF / YAML / JSON / large-file / merge-conflict
guards, `ruff` + `ruff-format` (backend), `prettier-frontend` and
`eslint-frontend`, `i18n-catalogs-in-sync`, plus the project-specific
guards (roadmap-archive reminder, plugin-lock pairing,
notify-error coverage, theme-token completeness, module-state audit).

Two shapes worth knowing when adding one:

- Frontend hooks shell out to the installed `npx` binary
  (`cd frontend && npx eslint src`), so they add no dependency of their
  own and use the same versions a developer runs by hand.
- Generated artefacts get a `--check` hook rather than a regeneration
  hook: `i18n-catalogs-in-sync` fails and tells you which command to
  run, instead of silently rewriting files mid-commit.

The backend test suite is deliberately NOT a hook: it takes ~10 s, which
is too slow for every commit. `make test` is the gate before pushing.

**Setup:**
```bash
cd backend && poetry run pre-commit install
```

## Error handling architecture

### Principle: handle errors at the right layer

```
Frontend       Shows the user what went wrong (toast). Catches ApiError.
    |
API client     Converts HTTP errors into ApiError. Only place for fetch().
    |
Router         Catches nothing. Global exception handler maps automatically.
    |
Service        Throws domain exceptions (ExportError, ValidationError). No HTTP concepts.
    |
Plugin         Throws PluginError. Caught by the exception handler.
    |
External       Pandoc, LanguageTool, edge-TTS. Wrapped inside the service.
```

Every layer catches only what it can handle itself. Everything else is passed up.

### Backend: exception hierarchy

```python
# backend/app/exceptions.py

class ToposError(Exception):
    """Base class for all Topos errors."""
    def __init__(self, message: str, detail: str | None = None):
        self.message = message
        self.detail = detail or message
        super().__init__(self.message)

class NotFoundError(ToposError):
    """Resource not found (-> HTTP 404)."""
    pass

class ValidationError(ToposError):
    """Domain validation failed (-> HTTP 400)."""
    pass

class ConflictError(ToposError):
    """Resource already exists (-> HTTP 409)."""
    pass

class ExportError(ToposError):
    """Export failed: Pandoc, scaffolding, conversion (-> HTTP 500)."""
    pass

class PluginError(ToposError):
    """Plugin could not load, activate, or run (-> HTTP 500)."""
    def __init__(self, plugin_name: str, message: str):
        self.plugin_name = plugin_name
        super().__init__(f"Plugin '{plugin_name}': {message}")

class ExternalServiceError(ToposError):
    """External service unreachable (-> HTTP 502)."""
    def __init__(self, service: str, message: str):
        self.service = service
        super().__init__(f"{service}: {message}")
```

### Backend: global exception handler

```python
# backend/app/main.py - register once

ERROR_STATUS_MAP = {
    NotFoundError: 404,
    ValidationError: 400,
    ConflictError: 409,
    ExportError: 500,
    PluginError: 500,
    ExternalServiceError: 502,
}

@app.exception_handler(ToposError)
async def topos_error_handler(request, exc: ToposError):
    status = ERROR_STATUS_MAP.get(type(exc), 500)
    logger.error(exc.message, exc_info=exc if status >= 500 else None)
    content = {"detail": exc.detail}
    if settings.debug and status >= 500:
        import traceback
        content["traceback"] = traceback.format_exception(exc)
    return JSONResponse(status_code=status, content=content)
```

### Backend: who throws what

**Services** throw domain exceptions, NEVER HTTPException:

```python
# RIGHT
def get_book(book_id: str, db: Session) -> Book:
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise NotFoundError(f"Book {book_id} not found")
    return book

def export_book(book_id: str, fmt: str, ...) -> Path:
    if fmt not in SUPPORTED_FORMATS:
        raise ValidationError(f"Unsupported format: {fmt}")
    try:
        return run_pandoc(project_dir, fmt, config)
    except subprocess.CalledProcessError as e:
        raise ExportError(f"Pandoc failed: {e.stderr}")

# WRONG: HTTPException in a service
def get_book(book_id: str, db: Session) -> Book:
    ...
    raise HTTPException(status_code=404, ...)  # NOT in services
```

**Routers** are thin, the exception handler takes over:

```python
# RIGHT
@router.get("/{book_id}")
def get_book_endpoint(book_id: str, db: Session = Depends(get_db)):
    return book_service.get_book(book_id, db)
    # NotFoundError -> exception handler -> 404 automatically
```

**Plugins** throw PluginError:

```python
class AudiobookPlugin(BasePlugin):
    def generate(self, book_data, chapters):
        try:
            result = edge_tts.synthesize(...)
        except ConnectionError as e:
            raise ExternalServiceError("edge-TTS", str(e))
        if not result.files:
            raise PluginError(self.name, "No audio generated")
```

**External tools** are wrapped:

```python
def check_grammar(text: str, lang: str) -> list[dict]:
    try:
        response = httpx.post(LANGUAGETOOL_URL, ...)
        response.raise_for_status()
        return response.json()["matches"]
    except httpx.ConnectError:
        raise ExternalServiceError("LanguageTool", "Service not reachable")
    except httpx.HTTPStatusError as e:
        raise ExternalServiceError("LanguageTool", f"HTTP {e.response.status_code}")
```

### Backend: rules

- Services throw ToposError subclasses, NEVER HTTPException.
- Routers catch NOTHING. The global exception handler takes over.
- No bare `except Exception`. Catch specific exceptions.
- Always wrap external errors into ExternalServiceError.
- Always surface plugin errors as PluginError with plugin_name.
- HTTP 422 comes from Pydantic automatically.
- Logging: 4xx as WARNING, 5xx as ERROR with traceback.

### Frontend: ApiError class

```typescript
// api/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public traceback?: string[],  // Only delivered by the backend in debug mode
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  get isNotFound(): boolean { return this.status === 404 }
  get isValidation(): boolean { return this.status === 400 || this.status === 422 }
  get isServerError(): boolean { return this.status >= 500 }

  /** Builds a GitHub Issue URL with all error details. */
  toGitHubIssueUrl(repo: string, appVersion: string): string {
    const title = encodeURIComponent(`[Bug] ${this.detail}`)
    const body = encodeURIComponent([
      `**Error:** ${this.detail}`,
      `**Status:** ${this.status}`,
      `**Version:** ${appVersion}`,
      `**Browser:** ${navigator.userAgent}`,
      this.traceback ? `\n**Stacktrace:**\n\`\`\`\n${this.traceback.join('')}\`\`\`` : '',
    ].filter(Boolean).join('\n'))
    return `https://github.com/${repo}/issues/new?title=${title}&body=${body}`
  }
}
```

### Frontend: central API client

```typescript
// api/client.ts
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(response.status, body.detail, body.traceback)
  }
  return response.json()
}
```

### Frontend: errors in components

```typescript
// RIGHT: specific + i18n + loading + issue button on 5xx
async function handleExport() {
  setLoading(true)
  try {
    await exportBook(bookId, format)
    toast.success(t('export_success'))
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isNotFound) {
        toast.error(t('book_not_found'))
      } else if (error.isServerError) {
        // Toast with a "Report issue" link for GitHub
        const issueUrl = error.toGitHubIssueUrl('astrapi69/topos', APP_VERSION)
        toast.error(`${error.detail} | ${t('report_issue')}: ${issueUrl}`)
      } else {
        toast.error(error.detail)
      }
    } else {
      toast.error(t('unexpected_error'))
    }
  } finally {
    setLoading(false)
  }
}

// WRONG: ignore the error
await exportBook(bookId, format)  // no catch

// WRONG: generic, no context
catch (error) {
  toast.error('Something went wrong')  // not helpful, not i18n
}
```

### Frontend: rules

- ALWAYS show API errors to the user (toast), never swallow them.
- No console.log for user feedback. Only toasts (react-toastify).
- Set loading states during API calls (no "dead" UI).
- ApiError class for all API errors, not generic Error.
- Error messages via i18n, no hardcoded strings.
- finally block for the loading-state reset.
- Toast on server errors (5xx) with a "Report issue" button that opens a GitHub Issue.
- The GitHub Issue contains: error detail as title, stacktrace (from the debug response), browser info, app version.
- Generic error messages ("Export failed") are forbidden, they make issues worthless.

---

## API conventions

Uniform REST design so humans and AI immediately understand how endpoints behave.

### URL schema

```
GET    /api/books                    # list
GET    /api/books/{id}               # single
POST   /api/books                    # create
PUT    /api/books/{id}               # full update
PATCH  /api/books/{id}               # partial update
DELETE /api/books/{id}               # delete

GET    /api/books/{id}/chapters      # subresource list
POST   /api/books/{id}/chapters      # subresource create
```

### Response format

```json
// Success (single)
{ "id": "abc", "title": "My Book", "author": "Asterios" }

// Success (list)
[{ "id": "abc", "title": "My Book" }, ...]

// Error (automatically from FastAPI/Pydantic)
{ "detail": "Book abc not found" }

// Validation error (automatically from Pydantic)
{ "detail": [{ "loc": ["body", "title"], "msg": "field required", "type": "value_error.missing" }] }
```

**Rules:**
- No envelope (no `{ "data": ..., "status": "ok" }`). The HTTP status is enough.
- IDs are UUIDs as strings.
- Timestamps as ISO 8601 (UTC).
- Lists are NOT paginated. Pagination only when needed.
- Plugin endpoints under /api/{plugin-name}/... (e.g. /api/grammar/check).

---

## Logging

### Backend

```python
import logging

logger = logging.getLogger(__name__)

# RIGHT: structured, with context
logger.info("Book exported", extra={"book_id": book.id, "format": fmt})
logger.warning("Plugin load failed", extra={"plugin": name, "error": str(e)})
logger.error("Export failed", extra={"book_id": book.id}, exc_info=True)

# WRONG:
print("export done")           # no print
logger.info(f"Exported {book}")  # no objects inside messages, use extra
```

**Log levels:**
- DEBUG: detailed developer info (only with TOPOS_DEBUG=true).
- INFO: important actions (export started, plugin loaded, backup created).
- WARNING: unexpected behavior that is not critical (plugin not found, fallback used).
- ERROR: errors that affect the user (export failed, DB error).

### Frontend

- No console.log in production code.
- console.warn and console.error only for real developer warnings.
- User feedback exclusively via toast notifications (react-toastify).

---

## Inline documentation

### When to write comments

```python
# RIGHT: the why, not the what
# Numbers are per container ("42-3"), so the highest wins rather than
# the count: deleting an entry must not hand its number to a later one.
next_number = (highest_external_id or 0) + 1

# WRONG: commenting the obvious
# Create a new container
book = Book(title=title, author=author)
```

**Rules:**
- Comments explain WHY, not WHAT.
- Docstrings for every public Python function (Google style).
- TypeScript: JSDoc only for exported functions with non-obvious parameters.
- TODOs only with context: `# TODO(phase-8): audiobook plugin needs ffmpeg check`
- No commented-out code blocks. Git is the versioning.

### Docstring format (Python)

```python
def export_book(book_id: str, fmt: str, options: ExportOptions) -> Path:
    """Export a book in the given format.

    Reads the three Ordner-Ordnung sheets, maps German priority and
    category labels onto their canonical values, and upserts the result
    idempotently.

    Args:
        book_id: UUID of the book.
        fmt: target format (epub, pdf, project).
        options: export options (toc_depth, use_manual_toc, book_type).

    Returns:
        Path to the exported file.

    Raises:
        HTTPException: 404 when the book is not found.
        ExportError: when Pandoc/manuscripta fails.
    """
```

---

## Summary: what happens automatically on every commit

```
git commit
  -> pre-commit hooks run:
     1. ruff check (Python lint)
     2. ruff format --check (Python format)
     3. eslint (TypeScript lint)
     4. prettier --check (TypeScript format)
     5. pytest -x -q (backend smoke test)
  -> all green? commit goes through.
  -> anything red? commit rejected, errors shown.
```

No code reaches the repo that isn't formatted, linted, and tested.

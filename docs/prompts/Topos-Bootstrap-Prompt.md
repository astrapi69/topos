# Topos Bootstrap Prompt for Claude Code

> Paste this entire document into Claude Code (CLI, on-the-web, or extension) as the initial task. The document is self-contained: every path, model, and acceptance criterion needed to deliver a working bootstrap is included.

---

## Mission

Bootstrap a new repository **`topos`** by customizing
`https://github.com/astrapi69/pluginforge-app-template`. Topos is a personal
inventory tracker for physical storage (file folders, archive boxes, drawers)
that runs as an offline-first PWA and as a cross-platform desktop app
(Linux/macOS/Windows). Backend in FastAPI + SQLite, frontend in
React + TypeScript with a Dexie cache.

The deliverable is **not** a complete production app. The deliverable is a
**working bootstrap**: template cleanly renamed, EXAMPLE-DOMAIN replaced with
the Topos domain (Container, Item, Category, Action), one minimal Excel-import
plugin, and the frontend scaffolded so the user can run `make dev` and see the
new domain end to end.

The user's existing Excel file `Ordner-Ordnung.xlsx` is the seed dataset. The
parser must understand its specific shape (described in Section 8).

---

## Context (read before starting)

1. **Template repository** — `https://github.com/astrapi69/pluginforge-app-template`
   - Read `README.md`, `CUSTOMIZE.md`, `CLAUDE.md`, and the files under
     `.claude/rules/` before touching any code.
   - The template uses placeholder `topos`/`Topos`/`TOPOS` everywhere. Section 4
     of this prompt is the global rename plan.
2. **Sibling projects** for pattern reference:
   - `https://github.com/astrapi69/adaptive-learner` — the reference downstream
     application. The patterns in its `.claude/rules/` are the template's source
     of truth. Look at it for proven solutions, not for code to copy.
   - `https://github.com/astrapi69/bibliogon` — content-authoring sibling.
3. **Out-of-scope work** (do **not** start, do **not** stub beyond what this
   prompt requires):
   - The TypeScript port of `astrapi69/tree-api` + `astrapi69/gen-tree`. A
     separate handover document (`Tree-Portierung-Uebergabe.md`) exists for
     that. For the bootstrap, `Category.path` as a slash-separated string is
     sufficient.
   - QR-code scanning, photo attachments, multi-device sync server, licensing
     activation.

---

## Hard constraints (non-negotiable)

1. **Code language is English.** All identifiers, comments, docstrings, commit
   messages, test names, and log lines are in English. No mixed vocabulary. No
   German names for Python/TypeScript symbols.
2. **User-facing strings live in i18n catalogs.** Default UI language is German;
   English is a parallel catalog. Do not hard-code German text into components.
3. **Excel-sheet names stay German.** They are real input data
   (`"Meine Ordner"`, `"Ordner Eltern"`, `"Boxen"`). The mapping from German
   Excel values to English enum values lives in **one** central translation map
   inside the importer plugin.
4. **Category slugs are English kebab-case in the URL/storage layer.** Display
   labels come from i18n. A separate `displayName` field on `Category` carries
   the human-readable label (German by default, since the user's data is
   German).
5. **No em-dashes (`—`) in any user-facing string, comment, commit message, or
   doc.** Use hyphens (`-`) or commas. This is a project-wide style rule from
   the user's preferences.
6. **No emojis in code, comments, commits, or UI** unless absolutely required.
7. **MIT license**, consistent with sibling projects.
8. **One feature = one commit = one PR.** Do not bundle phases into a single
   commit. Phase boundaries are commit boundaries.
9. **If you hit a real ambiguity, stop and ask.** Do not invent answers. Use
   the "Questions for the user" section at the end of your PR description.

---

## Phase 1: Repository bootstrap

**Goal:** Independent `topos` git repo seeded from the template, no upstream
remote attached.

**Steps:**

```bash
git clone https://github.com/astrapi69/pluginforge-app-template.git topos
cd topos
rm -rf .git
git init -b main
git add -A
git commit -m "chore: bootstrap from pluginforge-app-template@<short-sha>"
```

Replace `<short-sha>` with the short SHA of the template HEAD you cloned. This
provenance line lets the user trace the bootstrap to a specific template
revision.

**Acceptance criteria:**
- Working tree contains the full template.
- `git log` shows exactly one commit.
- `git remote -v` is empty (the user will add their own remote).

**Commit message:**
`chore: bootstrap from pluginforge-app-template@<short-sha>`

---

## Phase 2: Global rename sweep

**Goal:** Replace all `topos`/`Topos`/`TOPOS` placeholders with
`topos`/`Topos`/`TOPOS`. Update package metadata names.

**Steps:**

1. **Dry-run inventory** to confirm the scope:

   ```bash
   grep -rln "topos\|Topos\|TOPOS" \
       --include="*.py" --include="*.ts" --include="*.tsx" \
       --include="*.yaml" --include="*.yml" --include="*.json" \
       --include="*.toml" --include="*.md" --include="*.sh" \
       --include="*.cmd" --include="*.ps1" --include="Makefile" \
       --include="Dockerfile" --include="*.html" --include="*.css" .
   ```

2. **Apply the sweep** (order matters: uppercase, then mixed case, then
   lowercase):

   ```bash
   find . -type f \
       \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \
          -o -name "*.yaml" -o -name "*.yml" -o -name "*.json" \
          -o -name "*.toml" -o -name "*.md" -o -name "*.sh" \
          -o -name "*.cmd" -o -name "*.ps1" -o -name "Makefile" \
          -o -name "Dockerfile" -o -name "*.html" -o -name "*.css" \) \
       -not -path "./.git/*" -not -path "*/node_modules/*" \
       -not -path "*/__pycache__/*" \
       -exec sed -i \
           -e 's/TOPOS/TOPOS/g' \
           -e 's/Topos/Topos/g' \
           -e 's/topos/topos/g' \
           {} +
   ```

3. **Rename placeholder-bearing files/directories:**

   ```bash
   git mv launcher/topos_launcher launcher/topos_launcher
   git mv launcher/topos-launcher.spec launcher/topos-launcher.spec
   git mv launcher/topos.ico launcher/topos.ico
   mv backend/.topos-production backend/.topos-production 2>/dev/null || true
   ```

4. **Set package metadata names** (these are NOT the `topos` placeholder, they
   were the template's own publish names):
   - `backend/pyproject.toml`:
     - `name = "topos"`
     - `description = "Personal inventory tracker for folders, boxes, and what's inside them."`
     - `authors = ["Asterios Raptis"]`
   - `frontend/package.json`:
     - `"name": "topos-frontend"`
     - `"description": "Topos frontend. Personal inventory tracker for physical storage with hierarchical categories."`
   - `launcher/pyproject.toml`:
     - `name = "topos-launcher"`
     - `description = "Topos cross-platform desktop launcher."`

5. **Verify no placeholder remnants:**

   ```bash
   grep -rn "topos\|Topos\|TOPOS" --exclude-dir=.git --exclude-dir=node_modules . || echo "clean"
   ```

   The expected output is `clean`. If anything remains (e.g. inside a binary
   `.ico` or a docstring describing the template lineage), inspect each hit and
   decide case by case.

**Acceptance criteria:**
- `grep` for the placeholder returns no functional code hits.
- `make install` succeeds (backend Poetry venv + frontend npm install).
- `backend/app/main.py` has `app_id="topos"`.

**Commit message:**
`refactor: rename topos placeholder to topos across the tree`

---

## Phase 3: Replace EXAMPLE-DOMAIN with the Topos domain

**Goal:** Remove the Book/Chapter/Article/Comment example domain and replace it
with the Topos domain (Container, Item, Category, Action). The wiring shape
(model → schema → router → service → tests) stays identical to the template's
pattern; only the entity fields change.

### 3.1 Inventory the EXAMPLE-DOMAIN

Find every callsite:

```bash
grep -rn "# TEMPLATE:" backend/ frontend/ | tee /tmp/template-markers.txt
```

Every model, router, service, schema, test, and frontend page marked
`# TEMPLATE:` is fair game for deletion or repurposing.

### 3.2 Domain model specification

Implement the following SQLAlchemy 2.0 models in `backend/app/models/`. Use
mapped columns (the template's existing style). Place each entity in its own
file (`container.py`, `item.py`, `category.py`, `action.py`); export from
`backend/app/models/__init__.py`.

```python
# backend/app/models/container.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.item import Item


class ContainerType(str, Enum):
    FOLDER = "folder"
    BOX = "box"


class Owner(str, Enum):
    SELF = "self"
    PARENTS = "parents"
    SHARED = "shared"


class Container(Base):
    """A physical storage container: a file folder, an archive box, a drawer."""

    __tablename__ = "containers"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    type: Mapped[ContainerType] = mapped_column(SAEnum(ContainerType), index=True)
    owner: Mapped[Owner] = mapped_column(SAEnum(Owner), index=True)
    label: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(2000), default=None)
    location: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    size_group: Mapped[str | None] = mapped_column(String(50), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    items: Mapped[list["Item"]] = relationship(
        back_populates="container", cascade="all, delete-orphan"
    )
```

```python
# backend/app/models/item.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.action import Action
    from app.models.container import Container


class Priority(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class Item(Base):
    """A single inventoried content entry inside a container."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    container_id: Mapped[int] = mapped_column(ForeignKey("containers.id"), index=True)
    content: Mapped[str] = mapped_column(String(1000))
    priority: Mapped[Priority] = mapped_column(
        SAEnum(Priority), default=Priority.NONE, index=True
    )
    category_path: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    notes: Mapped[str | None] = mapped_column(String(2000), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    container: Mapped["Container"] = relationship(back_populates="items")
    actions: Mapped[list["Action"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
```

```python
# backend/app/models/category.py
from __future__ import annotations

from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Category(Base):
    """A node in the hierarchical category tree.

    `path` is the canonical slash-separated kebab-case English slug
    (e.g. "finance/bank/checking-account"). `display_name` is the user-facing
    label (German by default). Display names for other languages come from
    i18n catalogs keyed by `path`.
    """

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    path: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    parent_path: Mapped[str | None] = mapped_column(String(500), default=None, index=True)
    name: Mapped[str] = mapped_column(String(200))           # leaf slug
    display_name: Mapped[str] = mapped_column(String(200))   # human-readable
    level: Mapped[int] = mapped_column(Integer, default=0)
```

```python
# backend/app/models/action.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.item import Item


class ActionStatus(str, Enum):
    OPEN = "open"
    DONE = "done"
    ARCHIVED = "archived"


class Action(Base):
    """A pending or completed action attached to an item.

    Examples (from the user's Excel): "review and possibly cancel",
    "request statement", "check meter reading".
    """

    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), index=True)
    text: Mapped[str] = mapped_column(String(1000))
    status: Mapped[ActionStatus] = mapped_column(
        SAEnum(ActionStatus), default=ActionStatus.OPEN, index=True
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    item: Mapped["Item"] = relationship(back_populates="actions")
```

### 3.3 Pydantic schemas

In `backend/app/schemas/`, create one schema file per entity following the
template's pattern (e.g. `container.py` exports `ContainerCreate`,
`ContainerUpdate`, `ContainerRead`). Use Pydantic v2 with `model_config = ConfigDict(from_attributes=True)`.

### 3.4 Alembic migration

Generate a baseline migration:

```bash
cd backend && poetry run alembic revision --autogenerate \
    -m "replace example domain with topos domain"
```

Then **review and clean the migration manually**. If the example-domain tables
were never useful to the user, squash the `DROP TABLE` statements into the
baseline rather than carrying their drop history.

### 3.5 Delete unused EXAMPLE-DOMAIN files

Delete:
- `backend/app/models/book.py`, `chapter.py`, `article.py`, `comment.py`,
  `author.py`, `asset.py` (whichever exist)
- Their schemas in `backend/app/schemas/`
- Their routers in `backend/app/routers/`
- Their services in `backend/app/services/`
- Their tests in `backend/tests/`
- Their frontend pages (`BookEditor.tsx`, `ArticleEditor.tsx`, etc.) — but
  keep the file shapes if you can repurpose them in Phase 5.

### 3.6 Tests

For each new model, write a minimal pytest module under `backend/tests/models/`
that exercises:
- Creating an instance with required fields
- Default values (e.g. `Priority.NONE`, `ActionStatus.OPEN`)
- The `relationship()` linkage (container.items, item.actions)
- Unique constraint on `Container.external_id`
- Unique constraint on `Category.path`

**Acceptance criteria:**
- `poetry run pytest backend/tests/models/` is green.
- Alembic migration applies cleanly on a fresh SQLite file.
- `grep -rn "# TEMPLATE:" backend/` returns nothing.

**Commit message:**
`feat(backend): replace example domain with topos domain (container, item, category, action)`

---

## Phase 4: Backend services and routers

**Goal:** CRUD for the four entities, plus a small set of domain-specific
endpoints listed below. Layered architecture per the template
(`routers → services → models`).

### 4.1 Services

Create `backend/app/services/{containers,items,categories,actions}.py`. Each
service exposes plain functions (not classes) following the template's style:

```python
# backend/app/services/containers.py
def list_containers(db: Session, owner: Owner | None = None,
                    type: ContainerType | None = None) -> list[Container]: ...
def get_container(db: Session, container_id: int) -> Container | None: ...
def create_container(db: Session, payload: ContainerCreate) -> Container: ...
def update_container(db: Session, container_id: int,
                     payload: ContainerUpdate) -> Container: ...
def delete_container(db: Session, container_id: int) -> None: ...
def get_container_by_external_id(db: Session, external_id: int) -> Container | None: ...
```

Equivalent signatures for the other three entities.

### 4.2 Routers

Create `backend/app/routers/{containers,items,categories,actions}.py`.
Standard CRUD plus:

| Router | Extra endpoints |
|---|---|
| `containers` | `GET /containers/by-external-id/{external_id}` |
| `items` | `GET /items?container_id=X`, `GET /items/search?q=...` |
| `categories` | `GET /categories/tree` (returns nested tree), `GET /categories/children?parent_path=X` |
| `actions` | `GET /actions?status=open`, `POST /actions/{id}/complete`, `POST /actions/{id}/reopen` |

Wire all routers in `backend/app/main.py`. Tag each router with its entity
name for OpenAPI grouping.

### 4.3 Tests

Under `backend/tests/routers/`, write integration tests using the existing
fixture pattern. Each router gets at minimum:
- Happy-path CRUD round-trip
- 404 on missing id
- 422 on invalid payload

**Acceptance criteria:**
- `poetry run pytest backend/tests/` is green.
- `GET /docs` (Swagger UI) shows the four new tag groups.
- `curl http://localhost:8000/categories/tree` returns `[]` on a fresh DB.

**Commit message:**
`feat(backend): add CRUD services and routers for the topos domain`

---

## Phase 5: Excel-import plugin

**Goal:** A standalone PluginForge plugin that imports the user's
`Ordner-Ordnung.xlsx` into the database, idempotently.

### 5.1 Plugin layout

Create the plugin under `plugins/topos-plugin-excel-import/`:

```
plugins/topos-plugin-excel-import/
├── pyproject.toml
├── topos_excel_import/
│   ├── __init__.py
│   ├── plugin.py          # ExcelImportPlugin(BasePlugin)
│   ├── routes.py          # POST /import/excel
│   ├── parser.py          # the core parsing logic
│   └── mappings.py        # German→English value maps
└── tests/
    └── test_parser.py
```

Plugin class must declare `target_application = "topos"`. Register the plugin
in `backend/config/app.yaml` under `enabled`.

### 5.2 The parser (the actual hard work)

The user's Excel file has the following exact structure (column indices are
0-based):

**Sheet `"Meine Ordner"`** (29 columns, rows 1-223):

| Col | Header (German) | Meaning |
|-----|-----------------|---------|
| 0 | `Ordner-Nr` (implied) | Container external id (float in Excel, e.g. `1001.0`) |
| 1 | `Ordnerbeschreibung` | Container label/description (multi-row possible) |
| 2 | `Ordnerinhalt` | Item content |
| 3 | `Priorität` | Item priority (German values) |
| 4 | `Kategorienpfad` | Item category path (German, slash-separated) |
| 5 | `Ort` | Container location |
| 6 | `Aktion oder Handlung oder Status` | Action text |
| 7 | `neuer Ordner erforderlich` | "ja"/"nein", import as boolean flag, store in `Container.description` if `ja` |

**Parsing logic for "Meine Ordner":**

1. Row 1 is the header. Skip.
2. From row 2 onward, walk top to bottom maintaining a "current container":
   - If col 0 is a number → new container. `external_id = int(col[0])`.
     Container `label` comes from col 1, `location` from col 5, `description`
     starts empty.
   - If col 0 is empty AND col 1 is non-empty AND col 2 is empty → this is a
     **continuation row** for the previous container's description. Append col
     1 to `Container.description` (separated by `\n`).
   - If col 0 is empty AND col 2 is non-empty → this is an **item row**
     belonging to the current container. Create an `Item` with content=col 2,
     priority=PRIORITY_MAP[col 3], category_path=slugify(col 4),
     notes=None. If col 6 is non-empty and not in {"keine", "", None},
     create one `Action` per `;`-separated phrase.
3. `owner = Owner.SELF`, `type = ContainerType.FOLDER` for the entire sheet.

**Sheet `"Ordner Eltern"`** (4 columns, rows 1-71): same shape as "Meine
Ordner" but only cols 0-3 are used. `owner = Owner.PARENTS`,
`type = ContainerType.FOLDER`. No location, no actions in this sheet.

**Sheet `"Boxen"`** (28 columns, rows 1-166):

| Col | Header | Meaning |
|-----|--------|---------|
| 0 | (implicit) | Either a numeric box id (e.g. `3000.0`) OR a range header (e.g. `"3000 bis 3099"`) |
| 1 | `Box-Beschreibung` | Box label |
| 4 | `Inhalt` | Item content |
| 5 | `Kategorienpfad` | Item category path |

**Parsing logic for "Boxen":**

1. Row 1 is the header. Skip.
2. Walk rows. If col 0 matches the pattern `^\d+ bis \d+$` (e.g. "3000 bis
   3099"), it's a **size-group header**. Remember it as the current
   `size_group` string. Col 1 of this row is the size-group description (e.g.
   "Sehr große Boxen") - log it but do not persist as a separate entity.
3. If col 0 is numeric → new box container. Set `size_group` from the most
   recent group header.
4. If col 0 is empty and col 4 is non-empty → item row, current box is the
   parent.
5. `owner = Owner.SELF`, `type = ContainerType.BOX`.

### 5.3 German→English mappings (`mappings.py`)

```python
PRIORITY_MAP: dict[str, Priority] = {
    "sehr hoch": Priority.VERY_HIGH,
    "hoch": Priority.HIGH,
    "mittel": Priority.MEDIUM,
    "niedrig": Priority.LOW,
    "keine": Priority.NONE,
    "": Priority.NONE,
}
```

Category-path translation: implement a `slugify_category_path()` function that
takes a German path like `"Finanzen/Bank/Girokonto"` and produces an English
slug `"finance/bank/checking-account"` if known, otherwise falls back to a
mechanical slugification `"finanzen/bank/girokonto"` (lowercase, replace
spaces with hyphens, replace umlauts: ä→ae, ö→oe, ü→ue, ß→ss).

Keep a lookup table in `mappings.py` for the most common segments:

```python
CATEGORY_SLUG_MAP: dict[str, str] = {
    "Finanzen": "finance",
    "Bank": "bank",
    "Girokonto": "checking-account",
    "Aktien": "stocks",
    "Ausland": "foreign",
    "Griechenland": "greece",
    "Konto": "account",
    "Ordnung": "organization",
    "Hilfsmittel": "supplies",
    # Add more as discovered during import; unknown segments fall back to
    # mechanical slugification.
}
```

Original German segment must be preserved as `Category.display_name`.

### 5.4 Idempotency

The import is idempotent on `Container.external_id`:
- If a container with that external id already exists, **update** its fields
  (label, location, description) instead of inserting.
- Items are matched within a container by `(container_id, content)`. Existing
  items get their priority/category_path/notes updated; missing items are
  inserted.
- Actions are matched by `(item_id, text)`. Existing actions are left alone
  (their status may have changed since last import; do not reset).
- After upserting items, **delete** items in the DB that are no longer present
  in the imported sheet for that container — but only if a CLI flag
  `--prune-missing` is passed. By default, missing items are left alone.

### 5.5 Route

```python
# topos_excel_import/routes.py
from fastapi import APIRouter, UploadFile, File

router = APIRouter(prefix="/import", tags=["import"])

@router.post("/excel")
async def import_excel(file: UploadFile = File(...),
                       prune_missing: bool = False) -> ImportReport:
    """Import an Ordner-Ordnung.xlsx file into the Topos database."""
```

`ImportReport` is a Pydantic schema with counts: `containers_created`,
`containers_updated`, `items_created`, `items_updated`, `actions_created`,
`categories_created`, and a list of warnings (e.g. unmapped priority values,
unmapped category segments).

### 5.6 Tests

`tests/test_parser.py` uses a synthetic Excel file (built with `openpyxl`)
that exercises:
- Container row + 3 item rows
- Container row with multi-row description
- Box range-header detection
- Idempotent re-import (same file twice → no duplicates)
- `--prune-missing` semantics
- Unmapped priority value (e.g. `"super hoch"`) lands in the warnings list and
  is treated as `Priority.NONE`

**Acceptance criteria:**
- `poetry run pytest plugins/topos-plugin-excel-import/tests/` is green.
- `curl -F file=@Ordner-Ordnung.xlsx http://localhost:8000/import/excel`
  returns an `ImportReport` with sensible counts (roughly 50+ containers,
  300+ items based on the user's real file).
- A second import of the same file produces zero new inserts.

**Commit message:**
`feat(plugin): add excel-import plugin for ordner-ordnung.xlsx`

---

## Phase 6: Frontend pages

**Goal:** Scaffolded React frontend showing the new domain end to end.

### 6.1 Dexie schema

In `frontend/src/db/schema.ts` mirror the backend domain as TypeScript
interfaces plus a Dexie schema. Dexie serves as an offline cache; the backend
remains source of truth. Sync (Dexie ↔ backend) is **out of scope** for this
bootstrap — the cache is read-through only: pages fetch from the API, write
the response into Dexie, read from Dexie via `useLiveQuery` for reactivity.

```typescript
// frontend/src/db/schema.ts
import Dexie, { Table } from 'dexie';

export type ContainerType = 'folder' | 'box';
export type Owner = 'self' | 'parents' | 'shared';
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'very_high';
export type ActionStatus = 'open' | 'done' | 'archived';

export interface Container { /* mirror backend fields, camelCase in TS */ }
export interface Item { /* ... */ }
export interface Category { /* ... */ }
export interface Action { /* ... */ }

class ToposDB extends Dexie {
  containers!: Table<Container, number>;
  items!: Table<Item, number>;
  categories!: Table<Category, number>;
  actions!: Table<Action, number>;

  constructor() {
    super('ToposDB');
    this.version(1).stores({
      containers: '++id, externalId, type, owner, location',
      items: '++id, containerId, priority, categoryPath',
      categories: '++id, &path, parentPath, level',
      actions: '++id, itemId, status, dueDate',
    });
  }
}

export const db = new ToposDB();
```

Backend fields are `snake_case` in JSON; the API client at
`frontend/src/api/client.ts` is responsible for case conversion at the
boundary.

### 6.2 Pages

Replace the template's `frontend/src/pages/` files with:

| File | Purpose |
|------|---------|
| `Dashboard.tsx` | Counts (containers, items, open actions), recent activity, full-text search bar |
| `ContainerList.tsx` | Sortable/filterable table of all containers; filters: owner, type, location |
| `ContainerDetail.tsx` | Single container view with its item list, action shortcuts, edit form |
| `ItemEditor.tsx` | Form for creating/editing an item (content, priority dropdown, category-path picker, notes) |
| `CategoryBrowse.tsx` | Tree view of categories; clicking a category shows items under that subtree |
| `Actions.tsx` | Open actions list, grouped by container; one-click "mark done" |
| `Import.tsx` | Drag-and-drop excel upload calling POST /import/excel, shows ImportReport |
| `Settings.tsx` | Keep template version, extend with: language toggle (DE/EN), data export (JSON), reset DB |

Use the template's existing component primitives (Radix UI, react-toastify).
**Do not introduce new UI dependencies.**

### 6.3 i18n

Replace the example-domain strings in `backend/config/i18n/*.yaml` with Topos
strings. Keep the 8-language structure. For the bootstrap, fully populate only
`de.yaml` and `en.yaml`; for the other 6 languages, copy the English values as
placeholders (a follow-up task can translate them).

Required i18n keys (at minimum):

```
topos.container.label
topos.container.location
topos.container.type.folder
topos.container.type.box
topos.owner.self
topos.owner.parents
topos.owner.shared
topos.priority.none
topos.priority.low
topos.priority.medium
topos.priority.high
topos.priority.very_high
topos.action.status.open
topos.action.status.done
topos.action.status.archived
topos.page.dashboard.title
topos.page.containers.title
topos.page.categories.title
topos.page.actions.title
topos.page.import.title
topos.page.settings.title
topos.import.report.containers_created
topos.import.report.items_created
topos.import.report.warnings
```

### 6.4 Tests

For each page, one Vitest smoke test (render without crashing, key
text present). Add one Playwright e2e test under `e2e/` that:
1. Starts on Dashboard
2. Navigates to Import page
3. Uploads a tiny fixture xlsx
4. Asserts that ContainerList shows at least one row

**Acceptance criteria:**
- `npm run build` is green.
- `npm run test` is green (Vitest).
- `npm run dev` starts; manual smoke: navigate to each page, no console
  errors.

**Commit message:**
`feat(frontend): scaffold topos pages (dashboard, containers, categories, actions, import)`

---

## Phase 7: Docs and metadata

**Goal:** Repository surface (README, CONCEPT, ROADMAP, About) reflects Topos
rather than the template.

### 7.1 README.md

Replace the template's `README.md` with a Topos-specific version. Structure:

```markdown
# Topos

> Personal inventory tracker for folders, boxes, and what's inside them.

[1-paragraph description: physical storage inventory, offline-first PWA + desktop, syncable, plugin-driven, built on PluginForge.]

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features
[bullet list - see prompt section "Repository description" for the canonical list]

## Ecosystem
[bullet list of pluginforge, pluginforge-app-template, adaptive-learner, bibliogon]

## Quick start
[abridged from template, with topos commands]

## Architecture
[1-paragraph pointer to docs/CONCEPT.md]

## Repository layout
[copy from template, paths renamed]

## Status
[Honest one-paragraph: "bootstrap stage, not production-ready, see ROADMAP"]

## License
MIT - see LICENSE
```

Keep the same German counterpart pattern as the template: produce
`README-de.md` translating the Topos-specific sections.

### 7.2 docs/CONCEPT.md

Replace the template's `docs/CONCEPT.md` (which has a `TODO: Adapt for your
project` header) with a Topos-specific concept document. Sections:

1. **Goal** — what Topos is, who it's for, what problem it solves
2. **Domain model** — Container, Item, Category, Action (copy from this prompt's Section 3)
3. **Architecture** — backend/frontend/plugin layers, point to template's `.claude/rules/architecture.md` for the shared baseline
4. **Excel as bootstrap data source** — describe the migration path from spreadsheet to DB
5. **Sync strategy** — explicitly state: backend is source of truth; PWA's Dexie is a read-through cache; multi-device sync via REST API to the same backend; CouchDB-style multi-master sync is a non-goal
6. **Plugin extension points** — what plugins can do (import formats, export formats, QR generation, voice input, etc.)
7. **Out of scope** — what Topos deliberately doesn't do (cloud SaaS, multi-tenant, billing)

### 7.3 docs/ROADMAP.md

Replace the template's roadmap with:

```markdown
# Topos roadmap

## Done
- [x] Bootstrap from pluginforge-app-template
- [x] Topos domain model (Container, Item, Category, Action)
- [x] Excel-import plugin
- [x] Frontend scaffolding (dashboard, container/item/category/action views)

## Next
- [ ] TypeScript port of tree-api + gen-tree (see Tree-Portierung-Uebergabe.md)
- [ ] Replace string-based category_path with proper Tree structure in frontend
- [ ] QR-code generation plugin (print labels for containers)
- [ ] Photo-attachment support (one or more photos per container)
- [ ] PWA installability hardening (manifest, icons, install prompt)
- [ ] Desktop launcher build pipelines verified (Linux, macOS, Windows)
- [ ] i18n: translate the 6 placeholder languages
- [ ] Search: integrate MiniSearch for client-side full-text fuzzy search

## Later
- [ ] Voice input plugin (German speech-to-text for entry on mobile in basement)
- [ ] Export plugin (back to xlsx for backup)
- [ ] CSV import (sibling of excel-import)
- [ ] Family-shared mode (multi-user backend behind auth)
```

### 7.4 GitHub repo About

Set these via `gh repo edit` (or instruct the user to set them):

- **Description** (paste exactly):
  ```
  Personal inventory tracker for folders, boxes, and what's inside. PWA + desktop, offline-first, plugin-driven. Built on PluginForge.
  ```
- **Topics**: `inventory`, `personal-organization`, `pwa`, `desktop-app`,
  `fastapi`, `react`, `typescript`, `sqlite`, `indexeddb`, `pluginforge`,
  `offline-first`, `home-organization`, `file-organization`
- **Website**: leave empty for now

**Acceptance criteria:**
- `README.md`, `README-de.md`, `docs/CONCEPT.md`, `docs/ROADMAP.md` all
  reflect Topos, no `TODO: Adapt for your project` markers remain.
- `grep -rn "EXAMPLE-DOMAIN\|Book\|Chapter" docs/` returns nothing.

**Commit message:**
`docs: rewrite README, CONCEPT, and ROADMAP for topos`

---

## Phase 8: Final sanity sweep

**Goal:** No template residue, no broken links, no dead code.

### Checklist

```bash
# 1. No placeholder text anywhere in functional files
grep -rn "topos\|Topos\|TOPOS\|EXAMPLE-DOMAIN" \
    --exclude-dir=.git --exclude-dir=node_modules \
    --exclude="*.ico" --exclude="*.png" --exclude="*.jpg" . \
    && echo "FAIL: placeholders remain" || echo "OK"

# 2. All template markers removed
grep -rn "# TEMPLATE:" backend/ frontend/ \
    && echo "FAIL: TEMPLATE markers remain" || echo "OK"

# 3. No em-dashes in code or docs
grep -rn "—" --include="*.md" --include="*.py" --include="*.ts" --include="*.tsx" . \
    && echo "FAIL: em-dashes found" || echo "OK"

# 4. Backend boots
cd backend && poetry run python -c "from app.main import app; print(app.title)"

# 5. Backend tests green
cd backend && poetry run pytest

# 6. Frontend builds
cd ../frontend && npm run build

# 7. Frontend tests green
npm run test

# 8. Pre-commit clean
cd .. && pre-commit run --all-files

# 9. Type-check
cd frontend && npx tsc --noEmit
```

All nine commands must succeed before the bootstrap is declared done.

**Commit message:**
`chore: final sanity sweep, all checks green`

---

## Out of scope (do NOT start, even if tempted)

1. The TypeScript port of `tree-api`/`gen-tree`. A separate handover doc
   covers it. The bootstrap intentionally uses `Category.path` as a
   slash-separated string.
2. Multi-device sync server. The backend is the source of truth; deploy it
   on one machine and point multiple frontends at it.
3. QR-code scanning, photo attachments, voice input.
4. Activating the licensing infrastructure.
5. Bibliogon-style rich text editor / TipTap integration. Topos has no
   long-form editor.
6. Removing the launcher subsystem. Keep it, even if not used in Phase 1.
7. Replacing the plugin framework with something simpler. PluginForge stays.

## Workflow rules

1. **One phase = one feature branch = one PR.** Branch naming:
   `bootstrap/phase-N-<short-name>`, e.g. `bootstrap/phase-3-domain-models`.
2. **No phase skipping.** Phases 1 to 8 are executed in order.
3. **Each PR description must include:**
   - Summary of what changed
   - Test evidence (paste relevant pytest/vitest output)
   - "Questions for the user" section if anything was ambiguous
4. **If a hard constraint conflicts with reality, stop and ask.** Examples:
   "the user's Excel has a fourth sheet not described here" or "openpyxl
   reports col 0 contains a string instead of a float".
5. **Do not add new top-level dependencies** without explicit need. If you do,
   call it out in the PR description with reasoning.

## Definition of Done

The bootstrap is complete when **all** of the following hold:

- [ ] `make install && make test` is green from a fresh clone
- [ ] `make dev` starts backend on 8000 and frontend on 5173 without errors
- [ ] `POST /import/excel` with the user's `Ordner-Ordnung.xlsx` produces an
      `ImportReport` with non-zero counts, no exceptions
- [ ] A second import of the same file produces zero new inserts
      (idempotency holds)
- [ ] Browsing the frontend: Dashboard → ContainerList → ContainerDetail →
      CategoryBrowse → Actions → Import all render without console errors
- [ ] German UI labels appear by default; English labels appear after
      switching language in Settings
- [ ] `docs/CONCEPT.md` and `docs/ROADMAP.md` are Topos-specific (no
      template residue)
- [ ] All eight phase commits exist with the prescribed messages
- [ ] Phase 8 sanity sweep prints `OK` for all nine checks

---

## Questions to ask the user before starting (only if needed)

If anything below is unclear from this prompt, ask. Do not invent an answer.

1. The user mentioned the sibling `adaptive-learner` project uses bi-directional
   sync between desktop and PWA. This bootstrap does **not** implement sync
   (backend-as-source-of-truth is the chosen model). Is that acceptable for the
   bootstrap, or should sync be in scope?
2. The user has pen names (Asterios Raptis, Draven Quantum, Stelio Moon). The
   `authors` field in `pyproject.toml` should use which one? Default to
   `Asterios Raptis` unless told otherwise.
3. Should the launcher binary build be attempted as part of the bootstrap, or
   left as a follow-up? Default: leave as follow-up; just verify the launcher
   subsystem still installs as a Poetry package.

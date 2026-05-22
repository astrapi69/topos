# Build a bootstrap-automation script

Paste this verbatim into a fresh Claude Code session **at the
`pluginforge-app-template` repo root**. The session's job is to
build a script that automates the mechanical parts of customising
this template into a new application.

---

## Mission

The user manually customised this template into the **Topos**
application via an 8-phase bootstrap (rename, replace example
domain, generate CRUD, add a plugin, scaffold the frontend, write
docs, sanity-sweep). The transcript lives in
`/home/astrapi69/dev/git/hub/astrapi69/topos/docs/prompts/Topos-Bootstrap-Prompt.md`
and every phase landed as one atomic commit in the Topos repo.

Your job is to build a **script in this repo (the template)**
that automates the mechanical parts so the next person can run
one command + provide an entity manifest, and get to "ready for
domain-specific work" without manually redoing phases 1, 2, 3, 4,
7, 8 by hand.

## The proven reference

Each Topos commit is a worked example of one phase. Read them
end-to-end before writing a line of script. They are at
`/home/astrapi69/dev/git/hub/astrapi69/topos/.git/`; the SHAs:

| Phase | SHA | What it shows |
|---|---|---|
| 1 (bootstrap) | `57d8f6f` | unchanged template clone |
| 2 (rename) | `1e50ef0` | the full sed sweep + filesystem renames |
| 3 (domain) | `3c01a29` | replace EXAMPLE-DOMAIN with 4 new entities |
| 4 (CRUD) | `03d4f3b` | services + routers per entity |
| 5 (plugin) | `ab9d70c` | the first domain plugin (NOT automated) |
| 6 (frontend) | `262cb64` | pages + Dexie + hooks (shell yes, UX no) |
| 7 (docs) | `348b10d` | README + CONCEPT + ROADMAP rewrites |
| 8 (sweep) | `df61224` | sanity sweep + cleanup |
| (extra) | `185852f`, `bee22fc`, `c127a02`, `c302415`, `aabf2b2` | secrets feature + cleanup + handover |

Final state docs: `docs/handover.md` and `CLAUDE.md` at the Topos
HEAD (`aabf2b2`).

## Deliverable

A script under `scripts/bootstrap/` in this repo:

```
scripts/bootstrap/
├── bootstrap-app.sh        # CLI entrypoint
├── bootstrap.py            # Python implementation (sh thin wrapper)
├── templates/              # Jinja2 templates for generated files
│   ├── models/entity.py.j2
│   ├── schemas/entity.py.j2
│   ├── services/entity.py.j2
│   ├── routers/entity.py.j2
│   ├── README.md.j2
│   ├── README-de.md.j2
│   ├── CONCEPT.md.j2
│   ├── ROADMAP.md.j2
│   └── ...
├── example-manifest.yaml   # the Topos manifest reverse-engineered
├── DESIGN.md               # the design doc (write this FIRST)
└── README.md               # what the script does + does not do
```

CLI:

```bash
scripts/bootstrap/bootstrap-app.sh \
    --manifest path/to/entities.yaml \
    [--dry-run] \
    [--target-dir .]
```

Pick bash + Python stdlib + Jinja2 (already in the template's
MkDocs venv). Do not add new top-level deps.

## Manifest schema (sketch; refine in DESIGN.md before coding)

```yaml
app:
  name: topos                 # lowercase, replaces "myapp"
  pascal_name: Topos          # replaces "MyApp"
  upper_name: TOPOS           # replaces "MYAPP" (env-var prefix)
  description: "Personal inventory tracker for folders, boxes, and what's inside."
  short_tagline: "Personal inventory tracker"
  default_language: de
  supported_languages: [de, en, es, fr, el, pt, tr, ja]
  author_name: "Asterios Raptis"

entities:
  - name: Container
    plural: containers
    table_name: containers
    fields:
      - {name: external_id, type: int, unique: true, indexed: true}
      - {name: type, type: enum, enum_values: [folder, box], indexed: true}
      - {name: owner, type: enum, enum_values: [self, parents, shared], indexed: true}
      - {name: label, type: str, max_length: 500}
      - {name: description, type: str, max_length: 2000, nullable: true}
      - {name: location, type: str, max_length: 500, nullable: true, indexed: true}
      - {name: size_group, type: str, max_length: 50, nullable: true}
    timestamps: true
    relationships:
      - {kind: has_many, target: Item, back_populates: container, cascade: all-delete-orphan}
    extra_endpoints:
      - method: GET
        path: /by-external-id/{external_id}
        service_fn: get_container_by_external_id
        returns: ContainerRead
        not_found: "Container with external_id={external_id} not found"

  - name: Category
    plural: categories
    behaviour: tree            # triggers CategoryNode schema + GET /tree
    fields:
      - {name: path, type: str, max_length: 500, unique: true, indexed: true}
      - {name: parent_path, type: str, max_length: 500, nullable: true, indexed: true}
      - {name: name, type: str, max_length: 200}
      - {name: display_name, type: str, max_length: 200}
      - {name: level, type: int, default: 0}
```

The example manifest at `scripts/bootstrap/example-manifest.yaml`
**must reproduce the Topos domain exactly**, so running the
script against it produces a tree that passes Topos's Phase 8
checks.

## Automate (the YES list)

1. **Phase 1**: detect a clean template clone, refuse on
   customised trees, `rm -rf .git && git init -b main` + initial
   commit with provenance SHA.
2. **Phase 2**: sed sweep for `myapp / MyApp / MYAPP` across the
   exact file-extension set in Topos commit `1e50ef0`. Rename
   `launcher/myapp_launcher/`, `launcher/myapp.ico`,
   `launcher/myapp-launcher.spec`. Patch metadata in
   `backend/pyproject.toml`, `frontend/package.json`,
   `launcher/pyproject.toml`.
3. **Phase 3**: from the manifest, generate one
   `backend/app/models/<entity>.py` per entity using the model
   template; regenerate `models/__init__.py` re-exports. Same
   for schemas. Delete the EXAMPLE-DOMAIN files (the exact list
   lives in Topos commit `3c01a29` - copy it verbatim). Wipe
   `backend/migrations/versions/*.py`, run
   `alembic revision --autogenerate -m "initial <app.name> schema"`.
4. **Phase 4**: per entity, generate
   `backend/app/services/<plural>.py` (list / get / create /
   update / delete + extra_endpoints) and
   `backend/app/routers/<plural>.py` (thin CRUD + extras with
   OpenAPI tags). Patch `backend/app/main.py` to wire the new
   routers at the documented placeholder. Generate integration
   tests under `backend/tests/routers/` from a router-test
   template.
5. **Phase 6 (shell only)**: from the manifest, generate
   `frontend/src/types/<app>.ts`, `frontend/src/db/schema.ts`
   (Dexie tables per entity), `frontend/src/hooks/use<App>.ts`
   (stale-while-revalidate hooks per entity), the API client at
   `frontend/src/api/client.ts` with the 26-or-so endpoint
   surface, and stub pages
   `frontend/src/pages/<Entity>List.tsx` +
   `<Entity>Detail.tsx` per entity. Stub one Vitest smoke test
   per page (renders without crash).
6. **Phase 7**: render `README.md`, `README-de.md`,
   `docs/CONCEPT.md`, `docs/ROADMAP.md`, `docs/configuration.md`
   from Jinja2 templates filled from the manifest. The
   templates are derived from the Topos versions at HEAD; strip
   Topos-specific narrative ("file folders, archive boxes"),
   leave the structural skeleton.
7. **Phase 8 sanity sweep**: run every check from Topos's
   Phase 8 commit message - placeholders, # TEMPLATE: markers,
   em-dashes, backend boots, backend pytest, plugin pytest if
   plugins/ has anything, frontend build, Vitest, pre-commit,
   tsc --noEmit. Exit non-zero with an actionable report on any
   failure.
8. **Em-dash sweep**: replace U+2014 with hyphens in every file
   the script generated or sed-ed. Do not touch
   `.claude/rules/*.md` (template-lineage stays per the Topos
   convention).
9. **Atomic commits**: one commit per phase with the
   conventional-commit message templated from the corresponding
   Topos commit. Pre-commit hooks must pass on each.

## Do NOT automate (the NO list)

These need a human or an AI session to write. The script can
scaffold stubs but must NOT pretend to deliver:

1. **The first plugin (Phase 5).** Topos's Excel-import plugin
   was hand-written against a specific xlsx shape. The script
   can create `plugins/<app.name>-plugin-<name>/` with the
   minimal package layout and the `pyproject.toml` + entry
   point, but leaves the importer / parser empty.
2. **Frontend per-page UX.** Tree widgets, optimistic
   mark-done, drag-and-drop dropzones, global-search bars, the
   ImportReport card - none of that comes from a manifest. The
   script stubs the page; an AI fills the page.
3. **i18n catalog content beyond placeholders.** Two keys
   (`<app>.app.name`, `<app>.app.description`) are enough; full
   strings ship with the real pages.
4. **The Playwright e2e.** Scaffold a one-line smoke spec
   ("dashboard renders"); the journey spec gets written when
   the journey exists.

## Verification

Write an integration test that:

1. Copies the template to a tmp dir
2. Runs `bootstrap-app.sh --manifest example-manifest.yaml`
3. Confirms the resulting tree passes Topos's 9-check Phase 8
   sweep (re-implemented in the test, not invoked via Topos)
4. Confirms `make test` is green from a fresh `make install` in
   the resulting tree
5. Confirms `git log --oneline` shows the expected per-phase
   commit chain

This test is slow; tag it `slow` or skip in CI if too heavy.
Run it locally to confirm.

## Constraints to preserve (verbatim from Topos's hard rules)

- No new template-repo top-level dependencies. Bash + Python
  stdlib + Jinja2.
- The script must be idempotent: re-running it on an
  already-bootstrapped tree is a clean no-op or a clear
  "already bootstrapped" error, not corruption.
- No Topos-specific narrative in the templates. "Container",
  "inventory", "file folder" never appear in the generated
  output unless the manifest puts them there.
- No em-dashes (U+2014) in any generated file. Hyphens or
  commas.
- All German content in the templates uses real umlauts
  (ä ö ü ß).
- Generated routers stay thin; services raise typed errors;
  routers catch nothing.
- Generated paths use `app.paths.get_*_dir()` helpers, never
  CWD-relative.

## Process (mandatory order)

1. Read every Topos phase commit listed in the table above.
   Skim is not enough - the model + schema + router + service
   templates need to match Topos's exact shapes.
2. Read Topos's `docs/handover.md` and `CLAUDE.md` at HEAD.
3. Write `scripts/bootstrap/DESIGN.md` documenting:
   - The manifest schema (with three example entities -
     scalar fields, enum fields, tree behaviour)
   - The template file list + what each renders
   - The phase-by-phase plan
   - Idempotency strategy
   - The exact 9-check verification list
4. Show the design to the user. Get sign-off.
5. Implement bottom-up: templates first, then bootstrap.py,
   then bootstrap-app.sh wrapper.
6. Run the integration test against the example manifest.
7. Iterate until green.

## STOP and ask when

- The manifest schema doesn't fit a realistic third app (i.e.
  something that's neither Topos nor the current EXAMPLE-DOMAIN).
- A Topos phase commit does something non-mechanical that you'd
  need to replicate. Surface the case; let the user pick
  "automate" vs. "leave for the AI session that fills the
  scaffolds".
- A Phase 8 check can't be made to pass on scripted output.
  Report the gap; do not fake it green.
- You're about to add a new template-repo dependency. The
  constraint is hard.

## Anti-goals

- Auto-detecting the user's domain from natural-language input.
  The manifest is the contract; the human or AI writes the
  manifest by interviewing the user, then runs the script.
- Generating the first plugin from a template. Plugins are too
  varied.
- Migrating away from PluginForge.
- Making the script work on Windows in this iteration. Linux +
  macOS only is fine.

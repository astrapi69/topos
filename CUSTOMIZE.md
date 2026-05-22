# How to Customize This Template

You just cloned **pluginforge-app-template**. This is the user-facing guide to turning it into your own application.

> **Read this before running `make install`.** The steps below rename placeholders that `make install` would otherwise bake into a Poetry virtualenv / npm `node_modules` tree — easier to do *before* the install.

## Step 1: Clone and rename the working tree

```bash
git clone https://github.com/astrapi69/pluginforge-app-template.git my-app
cd my-app
rm -rf .git
git init
git remote add origin git@github.com:<you>/<my-app>.git
git add -A && git commit -m "chore: bootstrap from pluginforge-app-template"
```

You now have an independent repo. Discard the upstream `.git` to avoid accidentally pushing to the template.

## Step 2: Global rename

Replace the placeholder `topos` with your app name everywhere. The template uses **four** consistent variants:

| Variant | Where it appears | Replace with |
|---------|------------------|--------------|
| `topos` | snake/kebab — env vars, paths, configs, package roots | `yourapp` |
| `Topos` | PascalCase — class names, UI strings | `YourApp` |
| `TOPOS` | UPPER — env var names, constants | `YOURAPP` |
| (none) | `pluginforge-app-template` in `backend/pyproject.toml` & `frontend/package.json` `name` fields — your PyPI/npm publish name | `yourapp` (or `@scope/yourapp`) |

Recommended sweep:

```bash
# Inventory first (dry-run):
grep -rln "topos\|Topos\|TOPOS" --include="*.py" --include="*.ts" \
    --include="*.tsx" --include="*.yaml" --include="*.yml" \
    --include="*.json" --include="*.toml" --include="*.md" \
    --include="*.sh" --include="*.cmd" --include="*.ps1" \
    --include="Makefile" --include="Dockerfile" --include="*.html" \
    --include="*.css" .

# Then apply (adjust YOURAPP / YourApp / yourapp to your name):
find . -type f \
    \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \
       -o -name "*.yaml" -o -name "*.yml" -o -name "*.json" \
       -o -name "*.toml" -o -name "*.md" -o -name "*.sh" \
       -o -name "*.cmd" -o -name "*.ps1" -o -name "Makefile" \
       -o -name "Dockerfile" -o -name "*.html" -o -name "*.css" \) \
    -not -path "./.git/*" -not -path "*/node_modules/*" \
    -not -path "*/__pycache__/*" \
    -exec sed -i \
        -e 's/TOPOS/YOURAPP/g' \
        -e 's/Topos/YourApp/g' \
        -e 's/topos/yourapp/g' \
        {} +
```

Then rename the directories and files that carry the placeholder in their names:

```bash
git mv launcher/topos_launcher launcher/yourapp_launcher
git mv launcher/topos-launcher.spec launcher/yourapp-launcher.spec
git mv launcher/topos.ico launcher/yourapp.ico
mv backend/.topos-production backend/.yourapp-production 2>/dev/null || true
```

> The sed sweep also rewrites `app_id="topos"` in `backend/app/main.py` and any `target_application = "topos"` declarations on your plugin classes; no separate step needed. PluginForge v0.9.0 runs the host in hard-filter mode: plugins without a `target_application` matching the host's `app_id` are rejected at registration.

Finally update the package-metadata names (these are NOT `topos`-prefixed — they identify the template on PyPI/npm):

- `backend/pyproject.toml` → `name = "yourapp"`, description, authors
- `frontend/package.json` → `"name": "yourapp-frontend"`, description, author
- `launcher/pyproject.toml` → `name = "yourapp-launcher"`, description

## Step 3: Replace the EXAMPLE-DOMAIN models

The template ships with a content-authoring example domain (Book, Chapter, Article, Comment, Author, Asset) so the wiring (model → schema → router → service → frontend → tests) is concrete. Each model carries a `# TEMPLATE:` comment marking it as replaceable.

Recommended approach:

1. **Keep the wiring, change the fields.** Pick one entity (e.g. `Article`) and rename + re-field it to match your primary domain object. The CRUD endpoints in `backend/app/routers/articles.py`, the schema in `backend/app/schemas/`, and the frontend list/editor pages all follow a uniform shape that's worth preserving.
2. **Remove unused entities.** If your domain doesn't have a parent/child relationship like Book/Chapter, delete the `Book`/`Chapter` files and their routes. Search for `# TEMPLATE:` comments to find every callsite.
3. **Adjust relationships.** SQLAlchemy `relationship()` declarations live in `backend/app/models/__init__.py`. Update foreign-key columns to match your domain.
4. **Generate an Alembic migration.**
   ```bash
   cd backend && poetry run alembic revision --autogenerate -m "replace example domain with <yourdomain>"
   ```
   Review the migration before running it. Squash the auto-detected example-domain DROP TABLE statements into a clean baseline if you prefer to start from scratch.

## Step 4: Frontend pages and components

Replace TEMPLATE-marked pages in `frontend/src/pages/`:

- `Dashboard.tsx` → your main list view
- `ArticleEditor.tsx` / `BookEditor.tsx` → your primary edit view
- `Settings.tsx` → keep, extend with your domain-specific settings tabs

Same pattern applies in `frontend/src/components/` — keep the UI primitives (dialogs, dropdowns, toolbars, theme toggle) and replace domain-specific cards / forms.

## Step 5: First plugin

The template ships with **zero plugins**, but the loader is fully wired. Create your first plugin under `plugins/`:

```
plugins/yourapp-plugin-<name>/
├── pyproject.toml          # entry point: [project.entry-points."yourapp.plugins"]
├── yourapp_<name>/
│   ├── __init__.py
│   ├── plugin.py           # {Name}Plugin(BasePlugin) with target_application = "yourapp"
│   └── routes.py           # FastAPI router
└── tests/test_<name>.py
```

Every plugin class must declare `target_application = "yourapp"` (matching the `app_id` you renamed in Step 2). PluginForge v0.9.0 hard-filters any plugin without a match; see `plugins/README.md` for the minimal skeleton. Register the plugin in `backend/config/app.yaml` under `enabled`.

## Step 6: Configuration

- `backend/config/app.yaml` — app name, default language, DB path, plugin enable list
- `.env.example` — copy to `.env` for local dev; sets `YOURAPP_SECRET_KEY`, ports, debug flag
- `frontend/vite.config.ts` — dev server ports, PWA manifest, base path (for GitHub Pages)
- `mkdocs.yml` — docs site config (theme, nav, deploy URL)

## Step 7: Branding

- Replace `frontend/public/favicon.ico` and `frontend/public/icon-*.png` with your icons
- Update PWA manifest in `frontend/vite.config.ts` (name, short_name, theme_color)
- Update the launcher icon: `launcher/yourapp.ico`
- Update install-script banner in `install.sh.template` + `install.ps1.template`, then regenerate via `scripts/generate_install_sh.sh`

## Step 8: Verify

```bash
make install                          # Poetry + npm install
make test                             # full backend + frontend test suite
make dev                              # backend on :8000, frontend on :5173
```

Open http://localhost:5173 and confirm the dashboard loads. Browse the API docs at http://localhost:8000/docs.

## Step 9: Customize the rules

`.claude/rules/*.md` carries opinions from `adaptive-learner` and `bibliogon` development. Some are universally applicable (architecture layering, test isolation discipline, Conventional Commits); others are domain-specific incidents that won't apply to your app. Prune `.claude/rules/lessons-learned.md` accordingly — it's a starting point, not gospel.

## Step 10: Ship

When you're ready:

```bash
make verify-version-sync              # confirm version pins are in sync
make test                             # last green check
git tag v0.1.0
git push origin main --tags
```

Then trigger your first GitHub release. The launcher build workflows fire automatically on tag push (`launcher-{linux,macos,windows}.yml`) and attach single-file installer binaries to the release.

---

## Cheat sheet: the four files you almost always need to touch first

1. `backend/app/models/__init__.py` — replace EXAMPLE-DOMAIN entities
2. `backend/config/i18n/en.yaml` — replace English UI strings (then copy to other languages)
3. `frontend/src/pages/Dashboard.tsx` — your main list view
4. `CLAUDE.md` — tell Claude Code what your app actually is

Everything else (CRUD routes, schemas, services, tests, launcher, CI, Docker, MkDocs site) can stay as-is until you have a concrete need to change it.

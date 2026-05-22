# PluginForge App Template

Produktionsfähiges Projektgerüst zum Bauen plugin-getriebener Full-Stack-Anwendungen auf Basis von [PluginForge](https://github.com/astrapi69/pluginforge). Liefert ein sauberes FastAPI + React + TypeScript-Skelett mit CRUD, Einstellungen, i18n, Tests, CI, plattformübergreifendem Launcher und Docker-Deployment. Domänenmodelle werden als `EXAMPLE-DOMAIN` ausgeliefert — pro Projekt zu ersetzen.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Schnellstart

```bash
# Klonen und als eigenes Repo aufsetzen
git clone https://github.com/astrapi69/pluginforge-app-template.git my-app
cd my-app
rm -rf .git && git init

# Anpassungsleitfaden lesen BEVOR make install läuft
cat CUSTOMIZE.md
```

Dann [CUSTOMIZE.md](CUSTOMIZE.md) für die globale Umbenennung, den EXAMPLE-DOMAIN-Austausch und die ersten Plugin-Schritte folgen. Nach der Anpassung:

```bash
make install              # Poetry (Backend + Launcher) + npm (Frontend)
make test                 # Backend pytest + Frontend vitest
make dev                  # Backend auf :8000, Frontend auf :5173
```

## Was enthalten ist

### Backend
- **FastAPI**-App mit geschichteter Architektur (Routers → Services → Models)
- **SQLAlchemy 2.0** Mapped Columns + **Alembic**-Migrationen
- **Pydantic v2**-Schemas für Request/Response-Validierung
- **PluginForge**-Integration: Hookspec-Discovery, Entry-Point-Loader, Plugin-Lebenszyklus
- **Geschichtete Konfiguration**: Projekt-YAML < User-Override (`~/.config/myapp/`) < Env-Variablen (`MYAPP_*`)
- **Test-Isolation**: tmp-Datenverzeichnis + Produktions-Marker-Sicherung + In-Memory-Test-DB
- **i18n**: 8 Sprachen (DE, EN, ES, FR, EL, PT, TR, JA) in `backend/config/i18n/*.yaml`
- **Soft-Delete + Papierkorb-Lebenszyklus** auf EXAMPLE-DOMAIN-Entitäten (Book, Article, Comment)
- **Backup / Restore**-Gerüst (`backup_history`-Modell + Service)
- **Lizenzierungs**-Infrastruktur (HMAC-signierte offline-validierbare Schlüssel, standardmäßig ruhend)

### Frontend
- **React 18 + TypeScript (strict)** mit Vite-Build
- **Radix UI**-Primitive (Dialog, Tabs, Dropdown, Select, Tooltip)
- **@dnd-kit** für Drag-and-Drop, **Lucide React** für Icons, **react-toastify** für Feedback
- **Theming**: CSS Custom Properties, mehrere Paletten × hell/dunkel
- **Typisierter API-Client** in `frontend/src/api/client.ts` mit `ApiError`-Klasse und Toast-freundlicher Fehlerkette
- **i18n-Hook** (`useI18n`), liest die Backend-YAML-Kataloge

### Plugin-System
- **Keine Plugins enthalten** — der Loader ist verdrahtet und einsatzbereit
- `plugins/README.md` dokumentiert das minimale Plugin-Layout
- Hook-Specs in `backend/app/hookspecs.py`; Entry-Point-Gruppe `myapp.plugins`

### Launcher
- **Plattformübergreifender PyInstaller-Launcher** unter `launcher/` (Linux + macOS + Windows)
- Startet das Backend, öffnet das Frontend im Browser, verwaltet Auto-Update + Deinstallation
- Build-Pipelines pro OS: `.github/workflows/launcher-{linux,macos,windows}.yml`
- Single-Source-of-Truth für die Version (nur `backend/pyproject.toml` wird per Hand editiert; alle anderen Versionsfelder leiten sich via `make sync-versions` ab)

### CI/CD
- **GitHub Actions**: `ci.yml`, `coverage.yml`, `docs.yml`, `launcher-{linux,macos,windows}.yml`, `release-gate.yml`, `mutation-import.yml`
- **Pre-Commit-Hooks**: ruff (Lint + Format), check-yaml/json, trailing-whitespace, end-of-file-fixer
- **Release-Gate**-Erzwingung (Versionspins synchron; Subsystem-Lockstep; install.sh-Template-Aktualität)

### Docs
- **MkDocs Material** mit i18n (`mkdocs.yml`, `docs/pyproject.toml` enthält das Docs-Venv)
- `docs/CONCEPT.md`, `docs/ROADMAP.md`, `docs/API.md`, `docs/help/{en,de}/...`
- Generator-Skripte für ROADMAP-Archivierung, MkDocs-Nav, Audit-Reports

### Deployment
- **Docker Compose** (Dev + Prod)
- **install.sh / install.cmd / install.ps1 / install.command** Einzeiler-Installer
- **start.sh / stop.sh / uninstall.sh** Einstiegspunkte

## Tech-Stack im Überblick

| Schicht | Stack |
|---------|-------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry |
| Frontend | React 18+, TypeScript (strict), Vite, Radix UI, @dnd-kit, Lucide, react-toastify |
| Plugins | pluginforge ^0.10.0 (PyPI) |
| Launcher | PyInstaller |
| Tests | pytest, Vitest, Playwright, mutmut, Stryker |
| Werkzeuge | Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit |
| Docs | MkDocs Material |

## Repository-Struktur

```
pluginforge-app-template/
├── backend/app/           # FastAPI-Kern (main, models, routers, services, hookspecs)
├── backend/config/        # app.yaml + i18n/ (8 Sprachen)
├── backend/tests/         # pytest-Suite (mit Test-Isolations-Sicherungen)
├── plugins/               # leer + plugins/README.md
├── frontend/src/          # React-App (api, components, pages, styles)
├── e2e/                   # Playwright-Specs (smoke + full)
├── launcher/              # PyInstaller plattformübergreifender Launcher
├── docs/                  # MkDocs-Site + CONCEPT/ROADMAP/API
├── scripts/               # Versions-Sync, ROADMAP-Archiv, Audits
├── .github/workflows/     # CI/CD-Pipelines
└── Makefile, docker-compose*.yml, install.{sh,cmd,ps1,command}, .env.example
```

Siehe [CUSTOMIZE.md](CUSTOMIZE.md) als Feldführer für die Anpassung der einzelnen Teile.

## Ökosystem

| Repo | Rolle |
|------|-------|
| [pluginforge](https://github.com/astrapi69/pluginforge) | Plugin-Framework (PyPI). Die Laufzeit-Grundlage. |
| [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) | Dieses Template. Generisches Gerüst für neue PluginForge-Apps. |
| [adaptive-learner](https://github.com/astrapi69/adaptive-learner) | Referenz-Downstream-App. Die Muster in `.claude/rules/` sind hier entstanden. |
| [bibliogon](https://github.com/astrapi69/bibliogon) | Buch-Autorenplattform. Aus ihr wurde das ursprüngliche Skelett extrahiert. Attribution; keine Laufzeit-Abhängigkeit. |

## Kommandos

```bash
make install              # Poetry + npm install
make dev                  # Backend (8000) + Frontend (5173) parallel
make dev-bg / dev-down    # Hintergrund-Modus
make test                 # Backend pytest + Frontend vitest
make test-coverage        # Opt-in Coverage-Lauf
make test-backend         # nur Backend
make test-frontend        # nur vitest
make prod                 # Docker Compose (Prod-Compose-Datei)
make prod-down            # Docker stoppen
make clean                # Build-Artefakte entfernen
make help                 # alle Targets auflisten
```

E2E-Tests laufen NICHT im Standard-`make test`-Pfad. Separat ausführen:

```bash
npx playwright test --project=smoke
npx playwright test --project=full
```

## Versionierung

Das Template folgt Semantic Versioning. Die aktuelle Minor-Version (`v0.x`) spiegelt eine sich entwickelnde Template-Oberfläche wider; das erste feature-vollständige Release wird `v1.0.0`. Single Source of Truth für den Versions-Pin ist `backend/pyproject.toml`; alles andere leitet sich via `make sync-versions` ab.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

## Dokumentation

- [CUSTOMIZE.md](CUSTOMIZE.md) — erste Lektüre nach dem Clone
- [CLAUDE.md](CLAUDE.md) — Anleitung für die Arbeit mit Claude Code an diesem Codebase
- [docs/CONCEPT.md](docs/CONCEPT.md) — Architektur-Konzept
- [docs/help/de/](docs/help/de/) — In-App-Hilfe (auch via MkDocs ausgeliefert)
- [.claude/rules/](.claude/rules/) — Entwicklungsregeln (Architektur, Coding-Standards, Hygiene, Lessons Learned, Quality Checks, Release-Workflow)

# Topos

> Persönliche Inventarverwaltung für Ordner, Boxen und ihren Inhalt.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Topos ist eine quelloffene Web-Anwendung zum Erfassen physischer
Ablage - Hängeregister-Ordner, Archivboxen, Schubladen - und
ihres Inhalts. Einträge leben in hierarchischen Kategorien;
offene Folgeaktionen werden als Actions geführt; das ganze
Inventar ist durchsuchbar, filterbar und aus einer
Excel-Arbeitsmappe importierbar. Läuft als offline-fähige PWA im
Browser oder als plattformübergreifende Desktop-Anwendung über
PyInstaller.

English version: [README.md](README.md).

## Funktionen

- **Vier-Entitäten-Inventar** - Container (Ordner + Boxen),
  Einträge, hierarchische Kategorien, Folgeaktionen.
- **Excel-Import** - eine `Ordner-Ordnung.xlsx` (oder eine
  beliebige Mappe gleicher Drei-Blatt-Struktur) ablegen und Topos
  baut das Inventar inklusive der Vorfahren-Kategoriebaum auf.
  Idempotent über die Container-Externe-ID; ein erneuter Import
  derselben Datei erzeugt null Duplikate.
- **Deutsch -> Englisch Slug-Übersetzung** beim Import, das
  Original-Deutsch bleibt als Anzeigename erhalten.
- **Offline-fähige PWA** mit Dexie als Read-Through-Cache -
  Seiten rendern sofort aus IndexedDB, dann revalidiert die API.
- **Plugin-getriebene Erweiterbarkeit** auf Basis von
  [PluginForge](https://github.com/astrapi69/pluginforge): der
  Excel-Importer ist selbst ein Plugin. Künftige Importer,
  Exporter, QR-Etiketten und Foto-Anhänge folgen demselben
  Muster.
- **Plattformübergreifender Desktop-Launcher** (Linux, macOS,
  Windows) aus derselben FastAPI + React Codebasis.

## Ökosystem

Topos ist eines aus einer Familie von MIT-lizenzierten Projekten:

- [pluginforge](https://github.com/astrapi69/pluginforge) - das
  anwendungs-agnostische Plugin-Framework, auf dem Topos läuft
- [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) -
  das Gerüst, aus dem Topos extrahiert wurde
- [adaptive-learner](https://github.com/astrapi69/adaptive-learner),
  [bibliogon](https://github.com/astrapi69/bibliogon) -
  Geschwister-Anwendungen

## Schnellstart

```bash
git clone https://github.com/astrapi69/topos.git
cd topos
make install              # Poetry (Backend + Launcher) + npm (Frontend)
make test                 # Backend pytest + Frontend Vitest
make dev                  # Backend auf :8000, Frontend auf :5173
```

<http://localhost:5173> im Browser öffnen; das Dashboard
erscheint mit leerem Inventar.

Aus einer Excel-Mappe füllen:

1. `/import` im Browser öffnen.
2. Die `Ordner-Ordnung.xlsx` (oder eine Mappe mit den drei
   Blättern `Meine Ordner`, `Ordner Eltern`, `Boxen`) per
   Drag-and-Drop ablegen.
3. Auf Hochladen klicken.
4. Der Importbericht zeigt, wie viele Container, Einträge,
   Aktionen und Kategorien angelegt wurden; unter Container ist
   das Ergebnis sofort sichtbar.

Zum Desktop-Launcher (Einzelbinär-Installation) siehe
[launcher/README.md](launcher/README.md).

## Architektur

Vier Schichten: React-Frontend -> FastAPI-Backend -> PluginForge
-> Plugins. Container, Einträge, Kategorien und Aktionen liegen
im Kern; alles andere (Import, Export, QR-Etiketten,
Foto-Anhänge) wird als Plugin eingehängt. Das Backend ist die
einzige Wahrheitsquelle; der Dexie-Speicher der PWA ist ein
Read-Through-Cache. Lange Version: siehe
[docs/CONCEPT.md](docs/CONCEPT.md).

## Status

Bootstrap-Phase. Die sieben Phasen des Projekt-Bootstraps
(Umbenennung, Domänentausch, Services, Router,
Excel-Import-Plugin, Frontend-Seiten, Dokumentation) sind
abgeschlossen und getestet. Die Roadmap-Punkte unter
[docs/ROADMAP.md](docs/ROADMAP.md) listen die nächsten konkreten
Arbeiten: tree-api-Portierung, QR-Etiketten, Foto-Anhänge,
PWA-Härtung, Launcher-Binär-Pipeline.

Noch nicht produktionshart. Nicht ohne Reverse-Proxy und ohne
Austausch des Standard-`secret_key` auf gemeinsam genutzter
Infrastruktur betreiben (siehe
[docs/configuration.md](docs/configuration.md)).

## Lizenz

MIT - siehe [LICENSE](LICENSE).

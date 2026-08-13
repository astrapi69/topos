# Statusbericht Topos - 2026-08-13

Erstellt nach dem iPhone-Feldtest-Zyklus (Dateiwaehler, xlsx-Dispatch,
Kopier-Button) und vor dem v0.3.0-Release. Zahlen in diesem Bericht
wurden in derselben Session gemessen (Testlaeufe, gh-Abfragen, Grep
gegen den Baum); Annahmen sind als solche markiert.

## 1. Kurzueberblick

Topos ist ein persoenlicher Inventar-Tracker fuer physische Ablage
(Ordner, Boxen) und deren Inhalte: FastAPI/SQLite-Backend, React-PWA,
offline-first ueber einen Dexie-Storage-Seam, dazu ein
PyInstaller-Desktop-Launcher und ein Excel-Import/Export-Plugin.
Reifegrad: fruehes, aber diszipliniert gefuehrtes Projekt - v0.2.0
released, live auf GitHub Pages (buildHash 007655b), CI durchgaengig
gruen, TDD-Disziplin nachweisbar in den Commits. Seit v0.2.0 liegen 16
ungetaggte Commits auf main, darunter drei Features und die
bun-Migration. Die Kernfluesse (CRUD, Excel-Roundtrip, Foto-Erkennung,
Backup) funktionieren in beiden Betriebsmodi; die verbleibenden
Schwaechen sind Infrastruktur- und Randthemen, kein Kernrisiko.

## 2. Aktueller Status

Ziele (erkennbar aus CONCEPT/ROADMAP): Papier-Ablage digital
referenzierbar machen (Nummern wie 42-3), offline-first ohne
Serverzwang, Excel als verlustfreies Austauschformat,
Desktop-Distribution per Launcher.

### Stabil / aktiv gepflegt

- Frontend: 438 Vitest gruen, tsc + ESLint sauber, Token-basiertes
  Theming, 8 Sprachen mit erzwungener Key-Paritaet (463 Keys/Locale).
  Baumansicht des Gesamtinventars via @astrapi69/tree-kit frisch
  geliefert.
- Backend: 462 pytest gruen (1 skipped), mypy sauber, Test-Isolation
  dreischichtig (env-var, tmp-dir, Produktionsmarker-Tripwire).
- Build/CI: bun-Migration abgeschlossen (Resolution-Paritaet belegt,
  Build byte-identisch), alle 6 Workflows gruen, Deploy verifiziert
  gegen das Live-Bundle.
- PWA: Precache 1.62 MB (vorher 2.84), Manifest vollstaendig (id,
  Screenshots, Shortcuts, maskable 192+512), Install-Banner app-weit.
- Nach iPhone-Feldtests gehaertet: Dateiwaehler ohne Typ-Filter
  (iOS-Ausgrau-Falle), xlsx-Dispatch per Magic-Bytes in Einstellungen,
  Kopier-Button im Fehlerdialog.

### Unvollstaendig / riskant

- Die 31 Plugin-Tests laufen nirgends. `make test` = backend +
  frontend, die CI-Plugin-Matrix steht auf `if: false` mit dem
  veralteten Kommentar "skeleton ships zero plugins" - das Plugin
  existiert aber und traegt den Backend-Importpfad. Standalone
  schlagen die Tests mit `ModuleNotFoundError: app` fehl. Exakt das
  dokumentierte "wired != working"-Muster aus lessons-learned.
  CLAUDE.md behauptet "27 plugin" im Baseline-Lauf - stimmt operativ
  nicht.
- Fehlerdialog nur deutsch: der komplette error_report-Namespace
  existiert nur als Inline-Fallback, kein Katalog traegt die Keys -
  alle 8 Sprachen sehen Deutsch.
- Launcher-Hardware ungeprueft: Builds/Checksums fuer 3 OS
  verifiziert, aber niemand hat die Binaries auf macOS/Windows
  gestartet (SmartScreen/Gatekeeper offen). `--version` als
  Headless-Pfad existiert, ist aber noch nicht in die Build-Workflows
  verdrahtet.
- iOS bleibt Blindfleck der Automatisierung: drei echte Bugs am
  2026-08-13 nur durch manuelle Feldtests gefunden; Playwright deckt
  iOS-Picker/Safari-Eigenheiten prinzipiell nicht ab.

### Technische Schulden

- Excel-Logik doppelt gepflegt (Python-Plugin + Browser-TS, bewusst,
  aber driftanfaellig - der Roundtrip-Test ist die einzige Klammer).
- mutation-import.yml vermutlich weiter ohne erfolgreichen Lauf
  (Annahme, in dieser Session nicht geprueft).
- Uebersetzungen es/fr/pt/tr/el/ja ohne Muttersprachler-Review.
- Issues/PRs: 0 offen - Bug-Reports laufen ausschliesslich ueber den
  Chat, nichts ist im Tracker nachgehalten.

## 3. Risiken und Blocker

1. Ungetestetes Plugin in Produktion (hoch): der Backend-Excel-Import
   hat null laufende Tests. Eine Regression fiele erst beim Nutzer
   auf. Zusaetzlich verletzt der Zustand die Baseline-Behauptung in
   CLAUDE.md.
2. Release-Stau (mittel): 16 Commits seit v0.2.0, darunter Features
   und die Package-Manager-Migration. Je laenger ungetaggt, desto
   groesser der Blast-Radius eines Rollbacks.
3. iOS-Feldtest als einziger Qualitaetskanal fuer Mobile (mittel):
   drei Bugs an einem Tag, alle nur am Geraet sichtbar. Kein Ersatz
   vorhanden; mildern laesst sich das nur durch ein kurzes manuelles
   Testprotokoll pro Release.
4. Hardware-Gates (niedrig, extern): Launcher-Start auf macOS/Windows
   und Muttersprachler-Review brauchen Menschen/Geraete, keinen Code.
5. Doppelte Excel-Implementierung (niedrig): driftet sie, wird der
   Roundtrip lautlos lueckenhaft; der Content-Digest-Test faengt nur,
   was er kennt.

## 4. Priorisierte naechste Schritte

### P0 - sofort angehen

- Plugin-Tests reaktivieren. Begruendung: einziger produktiver
  Backend-Importpfad ohne laufende Tests; Zustand widerspricht der
  dokumentierten Baseline. Nutzen: Regressionsschutz + ehrliche
  Testzahlen. Erster Schritt: Ursache des ModuleNotFoundError klaeren
  (Import von app.main braucht das Backend im Pfad), dann `make test`
  um ein test-plugins-Target erweitern und die CI-Matrix aktivieren -
  inklusive erstem manuellen Workflow-Lauf als Beleg.
- iPhone-Retest der drei Fixes vom 2026-08-13 (Nutzer-Aktion): echte
  xlsx via "Kopie senden -> In Dateien sichern" holen, Import ueber
  Einstellungen UND Import-Seite pruefen, Kopier-Button im
  Fehlerdialog testen.

### P1 - als Naechstes

- Release v0.3.0 schneiden, sobald der Retest gruen ist. Feature-Stand
  ist kohaerent (bun, PWA-Haertung, Baum, iOS-Fixes); der
  Release-Workflow existiert und ist eingespielt.
- error_report-Namespace in die Kataloge (~13 Keys x 8 via
  apply_translation.py). Der Fehlerdialog - ausgerechnet die Stelle
  fuer Nutzer in Not - ist dann endlich lokalisiert.
- Launcher-Exec-Smoke in CI verdrahten: `./topos-launcher --version`
  nach jedem Build ausfuehren. "Artefakt startet" wird erstmals
  maschinell belegt.

### P2 - spaeter sinnvoll

- CSV-Import-Plugin (ROADMAP P3): derselbe Upsert-Pfad wie Excel,
  kleinster naechster Nutzwert.
- Manuelles iOS-Testprotokoll (Install-Banner, Import, Export,
  Fehlerdialog) als docs/manual-tests/ios.md, pro Release abhaken.
- mutation-import.yml einmal manuell dispatchen und Ergebnis
  dokumentieren - oder loeschen; wired-not-run ist der schlechteste
  Zustand.
- Muttersprachler-Review + Launcher-Hardware-Start: extern,
  unveraendert in "Blocked / Hardware".

## 5. Empfohlene Reihenfolge fuer die naechsten Arbeitstage

1. Heute: Plugin-Tests lauffaehig machen (lokal gruen -> `make test`
   -> CI-Matrix an, ein Dispatch-Lauf als Beleg). Parallel
   iPhone-Retest durch den Maintainer.
2. Morgen: v0.3.0 nach Release-Workflow schneiden (Changelog,
   sync-versions, volle Gate-Liste), damit der 16-Commit-Stau getaggt
   ist.
3. Danach: error_report-i18n und Launcher-Smoke in CI - beides klein,
   beides schliesst dokumentierte Luecken; dann CSV-Plugin als
   naechstes Feature.

## Offene Rueckfragen

1. Ist der iPhone-Retest mit einer echten xlsx inzwischen erfolgt -
   Import gruen?
2. Gibt es ausser dem Maintainer aktive Nutzer (entscheidet, wie
   dringend Uebersetzungs-Review und Launcher-Hardware-Tests sind)?
3. Steht macOS-/Windows-Hardware fuer den Launcher-Start zur
   Verfuegung, oder bleibt das dauerhaft "best effort, unsigned"?

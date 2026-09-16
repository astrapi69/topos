# CC Prompt: Impressum, Datenschutz, externe Ressourcen (Topos auf GitHub Pages)

## Ausgangslage

Unter https://astrapi69.github.io/topos/ liegt eine lauffaehige offline-first PWA
(Dexie-Modus, echtes CRUD in IndexedDB), nicht nur Dokumentation. Damit ist es ein
oeffentlich angebotener Telemediendienst. Impressum (§ 5 DDG) und
Datenschutzerklaerung (Art. 13 DSGVO) fehlen. ROADMAP, CONCEPT, README und SECURITY
erwaehnen das Thema nicht (verifiziert 2026-09-16).

Deploy-Fakten:
- `.github/workflows/deploy-gh-pages.yml` deployt NUR bei Push auf `main`
  (`workflow_dispatch` fuer Preview von develop).
- Build: `cd frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build`,
  Base-Pfad `/topos/`, Router `BrowserRouter` mit `basename`.

Aufteilung: CC liefert die technische Bestandsaufnahme, das Geruest und die
Uebertragung der bestehenden Rechtstexte. Die Datenschutzerklaerung wird anwaltlich
gegengelesen. Keine Rechtstexte erfinden.

## Quelle fuer Impressum und Datenschutz: adaptive-learner

Das Schwesterprojekt hat beides bereits umgesetzt (Session 2026-09-15, Issue
#3113, PR #3114). Pfad: `/home/astrapi69/dev/git/hub/astrapi69/adaptive-learner`.

- `docs/help/de/legal/imprint.md` und `docs/help/en/legal/imprint.md`: Name,
  Anschrift, E-Mail, Verantwortlicher nach § 18 Abs. 2 MStV, Haftung, Urheberrecht,
  VSBG-Hinweis. Betreiberangaben 1:1 uebernehmen, KEINE Platzhalter mehr noetig.
- `docs/help/de/legal/privacy.md` und `docs/help/en/legal/privacy.md`: Struktur
  (Verantwortlicher, Kurzfassung, GitHub Pages, Speicherung im Browser,
  KI-Funktionen mit eigenem Schluessel, externe Links, Kontakt, Rechte,
  Aenderungen) als Vorlage. Du-Form, Anschrift einzeilig mit Kommas (Begruendung im
  Journal `docs/journal/chat-journal-session-2026-09-15-legal.md`).
- Inhaltlich anpassen, nicht kopieren: Topos hat KEINE Buchempfehlungen/Amazon,
  KEINE YouTube-Vorschaubilder, KEINE Inhalte-Repositorys. Diese Abschnitte
  entfallen ("Zum Angebot" im Impressum ohne Eigenwerbung: pruefen, ob § 5 DDG bei
  Topos ueberhaupt greift, siehe Abschlussreport). Topos hat DAZU: eigenes Backend
  (Backend-URL), Fehlerbericht an GitHub, Desktop-Launcher mit Update-Check ueber
  die GitHub-API, Fotos in IndexedDB. Diese Abschnitte aus Punkt 1 und 2 neu.
- Umsetzungsweg dort: Hilfeseiten in der MkDocs-Site plus Links auf Startseite,
  Ueber-Tab und Landing-Footer. Topos hat KEINE aktive MkDocs-Site (`docs.yml`
  existiert, `mkdocs.yml` fehlt), also Punkt 3 als SPA-Routen, siehe unten.
- Spendenlinks (Liberapay, Ko-fi) sind in beiden Projekten gleich, Abschnitt
  "Externe Links" uebernehmbar.

## Vorab bekannte Fakten (verifizieren, nicht annehmen)

- Schriften sind self-hosted: `frontend/public/fonts/*.woff2` plus `LICENSES.md`.
  `frontend/index.html` hat keine `<link>`-Tags auf fremde Hosts, kein `preconnect`.
- Kein `document.cookie`, kein Analytics, keine Telemetrie im Frontend-Quellcode.
- Fremde Hosts im Frontend-Quellcode: `api.anthropic.com`, `api.openai.com`,
  `generativelanguage.googleapis.com`, `api.perplexity.ai`
  (`src/ai/browserAiClient.ts`, `src/ai/registry.ts`); `github.com`
  (`AboutSection.tsx` Repo- und Lizenzlink, `ErrorReportDialog.tsx` issues/new);
  `liberapay.com`, `ko-fi.com` (`AboutSection.tsx` Spenden); dazu die vom Nutzer
  konfigurierte Backend-URL (`localStorage` Key `topos.backend_url`).
- Erwartung: kein Request auf einen fremden Host ohne ausdrueckliche Nutzeraktion.
  Punkt 1 muss das am GEBAUTEN Artefakt und zur Laufzeit beweisen, nicht am
  Quellcode.

## 1. Bestandsaufnahme externer Ressourcen (Prio 1, technisch, eigener PR)

Groesstes konkretes Risiko: externe Ressourcen laden ungefragt die IP des Besuchers
zu Dritten.

- Artefakt = der GH-Pages-Build (Befehl oben). Analysieren: `dist/index.html`,
  `dist/404.html`, jedes `dist/<route>/index.html` (aus `STATIC_ROUTES` in
  `frontend/src/appRoutes.ts`), `dist/assets/*.js`, `dist/sw.js` samt
  Workbox-Precache-Manifest, `dist/manifest.webmanifest`, `dist/offline.html`,
  `dist/version.json`. Sourcemaps: `build.sourcemap` ist in `vite.config.ts` nicht
  gesetzt (Vite-Default aus); bestaetigen, dass keine `.map`-Datei in `dist/` liegt.
- Laufzeit-Beweis: Playwright gegen `vite preview` des Pages-Builds (Rezept in
  `.claude/rules/lessons-learned.md`, "Reproduce a reported UI bug"), Request-Log
  mitschneiden fuer: Erstaufruf, jede STATIC_ROUTE, PhotoIntake ohne hinterlegten
  Key, Settings > AI, Update-Check. Jeder Request auf einen anderen Origin als
  `astrapi69.github.io` kommt in die Tabelle.
- Ergebnis als Tabelle: Host, Zweck, ausgeloest bei welchem Aufruf,
  automatisch oder nur auf Nutzeraktion, vermeidbar ja/nein.
- Alles Vermeidbare lokal ausliefern.
- Guard: Vitest, der ueber `dist/` laeuft. Muster: `frontend/src/pwa/precache.test.ts`
  pinnt die Config; der neue Guard pinnt das Artefakt. Allowlist in EINER Datei
  (z.B. `frontend/external-hosts.allowlist.json`) mit schriftlicher Begruendung pro
  Host; Test rot bei jedem Host ausserhalb der Allowlist. Laeuft in CI nach dem
  Pages-Build (Job in `ci.yml` ergaenzen oder als Gate in `deploy-gh-pages.yml`).
  Test-Hosts aus dem Quellcode (`vps.example`, `backend.example`, `example.test`)
  duerfen nicht im `dist/` landen; der Guard prueft das mit.

## 2. Ausgehende Aufrufe der App dokumentieren (`PRIVACY.md`, Repo-Root neben `SECURITY.md`)

Vollstaendige Liste, was unter welchen Umstaenden das Geraet verlaesst. Topos-Stand
(jeden Punkt im Code verifizieren):

- **AI-Bilderkennung (PhotoIntake)**: Ausloeser ausdruecklich (Foto waehlen, Erkennen
  klicken). Inhalt: das Foto (clientseitig auf JPEG verkleinert, base64) plus Prompt
  mit Container-Typ und den bestehenden Kategorie-Pfaden. Empfaenger: der gewaehlte
  Provider (Anthropic, OpenAI, Google, Perplexity) mit dem eigenen Key des Nutzers.
  Dexie-Modus: browser-direkt (OpenAI ist CORS-blockiert, nur ueber Backend).
  API-Modus: ueber das eigene Backend (`POST /api/ai/vision`). Abschaltbar: kein Key
  hinterlegt oder `ai.enabled` aus.
- **AI-Verbindungstest (Settings > AI)**: Key-Probe an den Provider, nur auf Klick.
- **Backend-Modus**: saemtliche CRUD-Aufrufe gehen an die vom Nutzer eingetragene
  URL (`topos.backend_url`); Health-Probe `{url}/api/health` beim Speichern der URL.
  Pruefen, ob `utils/backendStatus.ts` spaeter periodisch probt.
- **Fehlerbericht**: `ErrorReportDialog` oeffnet
  `https://github.com/astrapi69/topos/issues/new` mit Fehlertext, Stacktrace,
  User-Agent und App-Version. Nur auf Klick, Inhalt vorher sichtbar.
- **Update-Check**: `@astrapi69/pwa-update` holt `<base>version.json` (same-origin,
  GitHub Pages); Service Worker `autoUpdate`. Automatisch. Das ist Hoster-Traffic,
  kein Drittdienst, trotzdem aufnehmen.
- **Externe Links**: Repository, MIT-Lizenz, Liberapay, Ko-fi in `AboutSection`.
  Nur auf Klick.
- **Desktop-Launcher** (nicht Pages, aber dieselbe `PRIVACY.md` deckt alle
  Verteilwege): `https://api.github.com/repos/astrapi69/topos/releases/latest` fuer
  den Auto-Update-Check; Opt-out dokumentieren (`launcher/topos_launcher/`).
- **Explizit NICHT vorhanden** (festhalten): Uebersetzungsdienste, Git-Push,
  Telemetrie, Analytics, Cookies.
- **Lokale Speicherung**: IndexedDB `topos` (Stores aus `frontend/src/db/schema.ts`
  uebernehmen, inkl. `photos`); localStorage `topos.ai_vault`
  (passphrase-verschluesselte Keys plus Klartext-Metadaten ohne Key-Material),
  `topos-theme`, `topos-app-theme`, `topos.backend_url`, `topos.container_types`,
  `topos.install_dismissed`, `topos.ios_install_dismissed`; Workbox-Precache und
  Runtime-Caches (exceljs-Chunk, `/api/`). Je Speicher: was liegt drin, wie loescht
  der Nutzer es (`handleResetCache` in `Settings.tsx` pruefen, was es wirklich
  loescht; Backup/Export; Browser-Site-Data). Fehlt ein "alles loeschen"-Weg, ist
  das ein Finding im Report, nicht stillschweigend bauen.

Je Punkt: laeuft es automatisch oder nur auf ausdrueckliche Aktion, und laesst es
sich abschalten. Im Topos-Tracker gibt es kein Issue zu Netzwerkzugriff: Issue
anlegen, nicht auf ein fremdes referenzieren.

## 3. Geruest fuer Impressum und Datenschutz (eigener PR)

Routing-Fakten: `STATIC_ROUTES` werden beim Build als `dist/<route>/index.html`
vorgerendert (HTTP 200 bei direktem Aufruf), `404.html` faengt den Rest; Workbox
`navigateFallback: <base>index.html` mit Denylist nur fuer `/api/`.

- Empfehlung: SPA-Routen `/impressum` und `/datenschutz` als React-Seiten plus
  Eintrag in `STATIC_ROUTES`. Direkter Aufruf = 200, Reload ok, der SW-Fallback
  landet auf derselben Seite, und die gebuendelten i18n-Catalogs (8 Sprachen)
  funktionieren offline. Alternative statische `impressum.html` / `datenschutz.html`
  in `frontend/public/` NUR mit Eintrag in `navigateFallbackDenylist`, sonst liefert
  der Service Worker `index.html` und die App-Route uebernimmt. Genau diesen Fehler
  muss der Playwright-Test abdecken. Entscheidung im Issue begruenden.
- Links: Topos hat keinen Footer. Erreichbar auf jeder Seite ueber die NavBar
  (Desktop-Topbar und Mobile-Tab-Bar, `components/NavBar.tsx`) und in
  Settings > About (`AboutSection.tsx`). Wird ein Footer eingefuehrt: im App-Shell,
  token-basiert (`ui/classes.ts`), in allen Theme-Varianten und Dark-Mode geprueft.
- Playwright-Spec `e2e/smoke/legal-pages.spec.ts`: Pages-Build ueber `vite preview`,
  direkter Aufruf `/topos/impressum` und `/topos/datenschutz`, Reload mit aktivem
  Service Worker, Assertion auf den Seiteninhalt per `data-testid`, nicht auf das
  Dashboard. Viewports 600/800/1080.
- Betreiberangaben aus `adaptive-learner/docs/help/de/legal/imprint.md`
  uebernehmen (siehe Abschnitt "Quelle"). KEINE erfundenen Daten, keine
  Platzhalter im Build. Einziger offener Platzhalter: `[[USt-IdNr]]` nur, wenn
  Aster eine nennt; sonst Zeile weglassen.
- Datenschutz-Text auf Basis der adaptive-learner-Vorlage mit den Abschnitten, die
  sich aus Punkt 1 und 2 sachlich ergeben: GitHub Pages als Hoster (GitHub Inc., IP-Uebertragung, Drittland USA),
  lokale Speicherung auf dem Endgeraet mit Begruendung der Erforderlichkeit
  (Offline-Inventar ist der Zweck der App), ausgehende Aufrufe an Drittdienste
  (AI-Provider mit Nutzer-Key, eigenes Backend, GitHub bei Fehlerbericht und
  Launcher-Update), externe Links. Sachliche Beschreibung der Technik, keine
  juristischen Formulierungen.
- Mehrsprachig ueber die bestehende i18n-Struktur: `scripts/apply_translation.py`
  plus `scripts/generate_i18n_catalogs.py` (Hook `i18n-catalogs-in-sync`).
  Mindestens DE und EN. Lange Prosa in YAML pruefen; wenn unhandlich, pro Sprache
  eigene Content-Datei vorschlagen und im Issue entscheiden lassen. DE mit echten
  Umlauten (Produktionsinhalt, siehe lessons-learned).

## Nicht Teil des Auftrags

Kein Cookie-Banner, kein Einwilligungsdialog. Begruendung im PR: kein
`document.cookie`, keine Analytics, nur erforderliche lokale Speicherung
(§ 25 Abs. 2 TDDDG, gleiche Einordnung wie adaptive-learner am 2026-09-12). Sollte
Punkt 1 etwas anderes ergeben, STOPP und Report.

## Regeln

Issue-First (`gh issue create`, im Commit `Closes #NN`), Branch von `develop`
(`feature/legal-...`), ein Concern pro PR (drei PRs), TDD wo Logik entsteht (Guard,
Routing, Denylist), `make test` gruen, `git status` vor Commit, nur
`git add [pfade]`, kein `Co-Authored-By` in keiner Form (coding-standards.md),
nach CI-gruen nach `develop` mergen.

WICHTIG: Pages deployt nur von `main`. Punkt 1 und 2 duerfen bis `main`. Punkt 3
darf bis `main`, sobald die Texte ohne Platzhalter sind und Aster den Diff der
Rechtstexte gelesen hat; anwaltliches Gegenlesen ist Folgeschritt, kein
Merge-Blocker (gleiche Entscheidung wie in adaptive-learner). Platzhalter gehen
nie live.

Docs: Journal-Eintrag unter `docs/journal/`, ROADMAP-Eintrag, CHANGELOG.

## Abschlussreport

- Tabelle der externen Hosts mit Bewertung (Artefakt und Laufzeit).
- Liste der ausgehenden Aufrufe (Stand `PRIVACY.md`).
- Offene Platzhalter (erwartet: keiner ausser USt-IdNr).
- Rechtlich zu bewerten, nicht technisch entscheidbar, mindestens: greift § 5 DDG
  bei Topos ohne Eigenwerbung und ohne Verkauf (adaptive-learner bejahte es wegen
  eigener Buchtitel; Topos hat nur Spendenlinks); gilt die Impressumspflicht auch
  fuer Launcher- und Docker-Verteilung; Grundlage fuer den
  Drittland-Transfer durch GitHub Pages; Rolle bei AI-Providern, wenn der Nutzer den
  eigenen Key mitbringt; ob der verschluesselte Key-Vault als Speicherung
  personenbezogener Daten zaehlt; Hinweispflicht zum Fehlerbericht-Inhalt
  (User-Agent).
- Abschnitt "Questions and assumptions" gemaess `.claude/rules/ai-workflow.md`.

# Chat-Journal 2026-09-16

## 1. Prompt-Anpassung: Impressum, Datenschutz, externe Ressourcen (Mittag)

- Original prompt: "passe den prompt an fuer uns" plus ein CC-Prompt aus
  dem Schwesterprojekt (A+ Content, DeepL, Git-Push, Issue #710).
- Optimized prompt: "Den Rechtstexte-Prompt auf Topos uebertragen: reale
  Deploy-Fakten, reale ausgehende Aufrufe, reale Speicher, Routing-Falle
  des Service Workers, Merge-Regel main = live."
- Goal: ein Auftrag, der am Topos-Repo verifiziert ist statt geraten.
- Result: `docs/prompts/Topos-Legal-Pages-Prompt.md`. Fakten vorab
  verifiziert: Pages deployt nur von `main`; Fonts self-hosted; kein
  `document.cookie`; fremde Hosts im Quellcode nur AI-Endpunkte,
  github.com, Spendenlinks; BrowserRouter + STATIC_ROUTES-Prerender +
  Workbox `navigateFallback` (statische HTML-Dateien braeuchten einen
  Denylist-Eintrag). Auf Asters Hinweis die Betreiberangaben aus
  adaptive-learner (`docs/help/{de,en}/legal/`, Session 2026-09-15) als
  Quelle statt Platzhalter eingetragen.
- Commit: keiner (Prompt-Datei mit diesem Journal committed).

## 2. PR 1: Bestandsaufnahme externer Hosts + Guard (Nachmittag)

- Original prompt: "so jetzt weiter".
- Goal: beweisen, was der Pages-Build nach draussen spricht, und das
  Ergebnis per Test einfrieren.
- Result: Issue #12, PR #13 (squash 7f3b2da). Statischer Scan von
  `dist/` (22 Hosts: 4 AI-Endpunkte nur auf Nutzeraktion mit eigenem
  Key, 4 Klick-Links, 6 XML-/JSON-LD-Namespaces, 7 Doku-URLs in
  Library-Fehlertexten, plus eigener Origin), 0 Sourcemaps, keine
  externen Tags. Laufzeit-Capture mit
  `e2e/tools/capture-external-requests.mjs` auf Browser-Context-Ebene:
  273 Requests, 0 extern, 70 vom Service Worker, ueber alle Routen,
  alle Settings-Tabs, Update-Check, PhotoIntake ohne Key, Reload mit
  aktivem SW. Guard `frontend/src/artifact/externalHosts.ts` +
  `external-hosts.allowlist.json` (Kategorie, Zweck, Ausloeser pro
  Host; unbekannte UND verwaiste Eintraege rot; Fremd-Tags in HTML ohne
  Ausnahme rot), 16 Vitest (RED beobachtet, dann GREEN). Verdrahtet in
  `ci.yml` (Pages-Build + Guard pro PR) und als Gate in
  `deploy-gh-pages.yml`. Audit-Doku
  `docs/audit/2026-09-16-external-hosts.md`.
- Reibung: erster CI-Lauf rot, weil `describe.skipIf` den Body beim
  Sammeln ausfuehrt und `auditDist` ohne `dist/` mit ENOENT starb;
  Fix in `beforeAll`, reproduziert mit weggeraeumtem `dist/` (rot ->
  5 skipped). Erstes Verzeichnis `src/build/` lag in `.gitignore`
  (`build/`), umbenannt nach `src/artifact/`.
- Commit: 7f3b2da.

## 3. PR 2: PRIVACY.md (Nachmittag)

- Goal: code-verifiziertes Inventar dessen, was das Geraet verlaesst
  und was bleibt, je Deployment.
- Result: Issue #14, PR #19 (squash f2a5eca). Je Punkt Ausloeser,
  Inhalt, Empfaenger, Abschaltweg: Foto-Erkennung (max. 1568 px JPEG
  0.75 + Kategorie-Pfade an Anthropic/OpenAI/Google/Perplexity mit
  eigenem Key; OpenAI nur ueber Backend), Key-Probe, Backend-Modus
  (alles an `topos.backend_url`, Health-Probe pro Seitenladen),
  Fehlerbericht (Issue-URL mit Meldung, 800 Zeichen Stacktrace,
  User-Agent, Version; nur Klick), Update-Check (`version.json`
  same-origin, SW autoUpdate), Launcher (`api.github.com` releases,
  Opt-out `auto_update_check`), Install-Skripte. Speicher: IndexedDB
  `topos` (5 Tabellen), 9 localStorage-Keys, Workbox-Caches, Backend-
  Datenverzeichnis. Explizit nicht vorhanden: Analytics, Telemetrie,
  Cookies, CDN-Fonts, Uebersetzungsdienste, Git-Push.
- Drei Findings als Issues statt still gebaut: #16 (Cache-Reset im
  Browser-Build loescht die Primaerdaten, Text verspricht Reload vom
  Server), #17 (Fotos nicht im Backup), #18 ("Adaptive Learner" in
  install.sh.template/uninstall.sh).
- Commit: f2a5eca. Danach `develop` -> `main` gemerged (afd96bc, nur
  PR 1 + 2); Pages-Deploy 35117077231 gruen, Guard-Gate auf den
  Live-Bytes bestanden.

## 4. PR 3: Impressum + Datenschutzerklaerung als App-Seiten (Nachmittag)

- Goal: von jeder Seite erreichbar, direkter Aufruf und Reload auf
  GitHub Pages ohne SPA-Rewrite, DE + EN.
- Result: Issue #15, PR #20 (squash nach develop). SPA-Routen
  `/impressum` + `/datenschutz` in `STATIC_ROUTES` (Prerender = 200,
  SW-Fallback landet auf derselben Seite), Texte in
  `frontend/src/legal/` (DE aus der AL-Vorlage angepasst: keine
  Buecher/YouTube/Inhalte-Repos, dafuer eigenes Backend,
  GitHub-Fehlerbericht, Launcher-Versionsabfrage, Fotos in IndexedDB;
  EN spiegelt DE), `pickLegalLocale` (de* -> DE, Rest -> EN mit
  Hinweis), `LegalPage`, `AppFooter` unter jeder Route, zwei Links in
  Settings > About, `topos.legal.*` in allen 8 Katalogen (YAML per
  Textinsertion hinter `nav:`, weil `apply_translation.py` eine Locale
  komplett neu baut; Paritaetstests 75 gruen). Playwright gegen den
  servierten Pages-Build (`playwright.pages.config.ts` +
  `tools/serve-pages.mjs` mit Pages-Semantik): direkter Aufruf 200,
  Reload mit aktivem SW, Footer-/About-Links, 600/800/1080 px, 8 gruen.
  Vitest 492 gruen (Rechtstexte nennen Betreiber, kein Platzhalter,
  Regression-Pin gegen AL-Wortlaut, Links gegenseitig, `noopener`).
  Der Guard fing die fuenf neuen Anbieter-Datenschutz-Links als
  unbekannte Hosts; als Klick-Links allowlisted. Screenshots hell,
  dunkel, mobil geprueft; Abstaende der `h2` per Tailwind-Child-
  Selektoren nachgezogen (24bb037).
- Reibung: Branch von lokalem `develop` VOR dem Squash von PR 13
  abgezweigt, Guard fehlte; Rebase auf `origin/develop`. `pkill -f`
  mit dem Muster im eigenen Kommandotext hat die Shell gekillt.
- Commit: a0f05c1, 24bb037 (squash nach develop). NICHT nach `main`:
  wartet auf Asters Lesen der Texte.

## Fragen und Annahmen

- Offen: Impressum-Mailbox. adaptive-learner veroeffentlicht
  `asteri.raptis@gmail.com`, das GitHub-Konto nutzt
  `aster.raptis@gmail.com`. Uebernommen wie veroeffentlicht,
  `TODO(clarify)` in `frontend/src/legal/operator.ts`.
- Offen: USt-IdNr. keine gezeigt; Zeile entfaellt, bis eine genannt
  wird.
- Offen (rechtlich, nicht technisch): greift § 5 DDG bei Topos ohne
  Eigenwerbung und Verkauf (AL bejahte wegen eigener Buchtitel, Topos
  hat nur Spendenlinks); Impressumspflicht auch fuer Launcher-/Docker-
  Verteilung; Rolle bei AI-Anbietern mit Nutzer-Key; verschluesselter
  Key-Tresor als Speicherung personenbezogener Daten; Hinweispflicht
  zum Fehlerbericht-Inhalt (User-Agent). Anwaltliches Gegenlesen als
  Folgeschritt (ROADMAP P3).
- Annahme: Routen-Slugs `/impressum` und `/datenschutz` (deutsch) wie
  im Prompt, obwohl alle anderen Routen englisch sind; AL nutzt
  `legal/imprint`.
- Annahme: Rechtsprosa nur DE + EN, andere Locales mit Hinweis auf EN,
  statt sechs ungeprueft uebersetzte Rechtstexte in die Kataloge zu
  legen. Kurze Labels in allen 8 Sprachen.
- Annahme: Footer im App-Shell statt NavBar-Eingriff, damit die
  Zentrierungs-Tests der NavBar unberuehrt bleiben.
- Annahme: Cookie-Banner nicht noetig (§ 25 Abs. 2 Nr. 2 TDDDG),
  gestuetzt auf die Messung aus PR 1.

## Zusammenfassung

- Issues #12, #14, #15 (erledigt), #16, #17, #18 (Findings, offen).
- PRs #13, #19 (gemerged, live auf main), #20 (gemerged nach develop).
- Tests: 469 Backend + 1 skipped, 35 Plugin, 492 Frontend Vitest,
  8 Playwright (Pages-Build). Laufzeit-Audit: 273 Requests, 0 extern.
- Neue Werkzeuge: `e2e/tools/capture-external-requests.mjs`,
  `e2e/tools/serve-pages.mjs`, `e2e/playwright.pages.config.ts`.
- Doku: `PRIVACY.md`, `docs/audit/2026-09-16-external-hosts.md`,
  CHANGELOG Unreleased, CLAUDE.md/architecture.md Seitenlisten, zwei
  Lessons-learned-Eintraege (skipIf-Body, pkill -f).

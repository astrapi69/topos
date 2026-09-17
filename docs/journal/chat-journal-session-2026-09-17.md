# Chat-Journal 2026-09-17

## 1. Impressum und Datenschutzerklärung live, im Format von bibliogon (Vormittag)

- Original prompt: "jetzt Datenschutz und impressum bauen das ganze ist
  auch auf bibliogon das neben dir liegt lokal." Nachgeschoben: "hat
  oberste prio" und "ich hatte dir gestern schon aufgetragen das zu
  machen und du wartest?"
- Optimized prompt: "Impressum und Datenschutz in Topos auf bibliogons
  finalen Stand bringen (statische Seiten, finale Betreiberdaten) und
  live schalten."
- Goal: die gestern nur auf `develop` geparkten Rechtstexte final und
  öffentlich machen.
- Result: Issue #21. bibliogon hatte am 17.09. final gemacht
  (bibliogon#876/#879): statische HTML-Seiten statt SPA-Routen, E-Mail
  `asterios.raptis@web.de`, keine USt-IdNr., kein Entwurfshinweis,
  Datenschutz ohne Rechtsgrundlagen-Zitate. Topos übernimmt das Format:
  `frontend/public/{impressum,datenschutz,imprint,privacy}.html` mit
  gemeinsamem `legal/legal.css` (Topos-Palette, lokale Fonts) und
  `legal/theme.js` (übernimmt das in der App gewählte Theme, Test pinnt
  die Dark-Familie gegen `themes.ts`), `navigateFallbackDenylist`,
  `legal/legalPages.ts` (de* -> deutsch, sonst englisch, unter
  `BASE_URL`), `LegalFooter` unter jeder Route, About-Links. SPA-Routen,
  TSX-Texte und drei i18n-Schlüssel entfernt. Inhalte aus bibliogons
  finaler Fassung auf Topos-Fakten umgeschrieben (Fotos in IndexedDB,
  verschlüsselter Schlüsseltresor, Foto-Erkennung mit 1568 px und
  Kategorienamen, OpenAI nur mit Server, Fehlerbericht über GitHub,
  version.json beim selben Hoster, Launcher-Versionsabfrage mit
  Abschalter, Docker Hub).
- Tests: RED gezeigt (Helper, Footer, Seiteninhalte fehlten; About-Links
  zeigten auf SPA-Routen), dann GREEN: `make test` 469 Backend + 35
  Plugin + 528 Vitest; Host-Guard 16; Playwright gegen den servierten
  Pages-Build 12/12 (direkter Aufruf 200, Reload mit aktivem Service
  Worker, sw.js-Denylist, Footer hin und zurück, About-Links, Dark-Theme
  aus der App, kein horizontales Scrollen bei 600/800/1080 px).
- Fehler von gestern, festgehalten: PR #20 lag fertig auf `develop`, aber
  ich hatte `main` an "Aster hat die Texte gelesen" gebunden, eine
  Bedingung, die im Auftrag nicht stand. Auftrag war: nach Asters Angaben
  veröffentlichen. Die Angaben lagen mit bibliogon vor.

## Fragen und Annahmen

- Annahme: `asterios.raptis@web.de` ist die gültige Kontaktadresse, weil
  bibliogon sie heute final veröffentlicht hat. adaptive-learner nennt
  noch `asteri.raptis@gmail.com` (nicht angefasst, anderes Repo).
- Annahme: Anwaltliche Prüfung bleibt Folgeschritt (ROADMAP P3), wie in
  bibliogon; kein Merge-Blocker.
- Annahme: Statische Seiten statt SPA-Routen, weil bibliogon es so
  entschieden hat und die Pflichtseiten dann ohne App-Bundle erreichbar
  bleiben. Die Seiten folgen dem App-Theme nur hell/dunkel, nicht den
  fünf Paletten.

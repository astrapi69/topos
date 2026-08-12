# Chat-Journal - Session 2026-08-12

Lange Sitzung, die als Bugfix begann und im Release v0.2.0 endete.
Roter Faden: gemeldete Symptome erst im echten Browser messen, dann die
Ursache beheben - mehrfach lag sie eine Ebene tiefer als der Bericht.

## 1. Foto-Erkennung "geht nicht" - CORS gemessen statt geraten (17:20)

- Original prompt: "das mit den foto erkennen geht nicht!!!" - wichtigstes
  Feature, ohne das die App wertlos sei. Spaeter: "alle provider sollen
  funktionieren!!! Warum nur Anthropic?"
- Optimized prompt: "Foto-Erkennung schlaegt fehl. Bitte im deployten PWA
  reproduzieren, Ursache messen (nicht vermuten) und alle Provider
  freischalten, die technisch koennen."
- Goal: Erkennung offline nutzbar machen.
- Result: Die `corsBlocked`-Flags waren **geraten**. Eine Probe vom
  GitHub-Pages-Origin gegen die echten Vision-Endpunkte (Dummy-Keys,
  erreicht-vs-blockiert) ergab: anthropic, google und perplexity erreichen
  ihre Endpunkte, nur OpenAIs Chat-Endpunkt sendet keine CORS-Header.
  Falle dabei: OpenAIs `GET /v1/models` erreicht (401) - wer den als Proxy
  testet, haelt OpenAI faelschlich fuer browser-faehig. Immer den Endpunkt
  pruefen, den die Produktion wirklich ruft.
- Commit: 7391ab3

## 2. Zwei Offline-Sackgassen in der Foto-Erfassung (17:40)

- Original prompt: Screenshots, "Erkennen" ausgegraut; spaeter "Uebernehmen
  ist ausgegraut und da steht Backend-Verbindung noetig - das stimmt nicht".
- Goal: Ablauf offline durchgaengig machen.
- Result: Zwei stehengebliebene Backend-Gates. Container liessen sich
  offline nicht anlegen (kein Ziel -> "Erkennen" nie aktiv), und
  "Uebernehmen" war gesperrt, obwohl `getStorage().items.bulkCreate`
  offline in IndexedDB schreibt. Beide Tests hatten das falsche Verhalten
  festgenagelt - erst RED auf das richtige umgeschrieben, dann gefixt.
- Commits: 1920042, bf909df

## 3. Excel: Export fertig, Import in den Browser, Round-Trip verlustfrei (18:30)

- Original prompt: "ich hab schon mal den excel export angefangen, mach du
  weiter" - spaeter "Geht der roundtrip? mit checksum vergleich?" und
  schliesslich "Das sollte einwandfrei funktionieren".
- Goal: Excel in beide Richtungen, ohne Datenverlust.
- Result: Der angefangene Export lief auf `xlsx` (SheetJS), die Dependency
  war aber `exceljs` - auf exceljs vereinheitlicht (SheetJS ist auf npm
  veraltet). Import zusaetzlich clientseitig gebaut, damit die PWA ohne
  Backend importiert. Zur Checksum-Frage gemessen: **Datei-Pruefsummen
  taugen nicht** - xlsx ist ein ZIP mit Zeitstempeln, zweimal derselbe
  Export ergibt andere Bytes. Verglichen wird ein Digest ueber die
  Zellmatrix. Erste Messung: sechs strukturelle Verluste (owner "shared",
  Eltern-Ort, Notizen, nicht ableitbare Kategorie-Slugs, Box-Prioritaet,
  erledigte Aktionen). Format erweitert (nur angehaengte Spalten +
  "Kategorien"-Blatt), danach verlustfrei - und ueber die Laufzeitgrenze
  geprueft: Browser-Datei importiert im Backend-Plugin und umgekehrt.
- Commits: 99d6457, bc2acc2, 22d563e

## 4. Item-Nummern 42-3 (11:00)

- Original prompt: "schoen waere es wenn die items auch eine id bekaemen,
  auch wenn diese keine am anfang haben" - danach editierbar gewuenscht,
  mit dem Hinweis "ordner id + item id waeren eindeutig".
- Goal: Eintraege physisch referenzierbar machen.
- Result: Nummer pro Container, vergeben als "hoechste + 1" (nicht
  "Anzahl + 1", sonst erbt ein spaeterer Eintrag die Nummer eines
  geloeschten). Nachtraegliche Vergabe doppelt abgesichert: Alembic-
  Migration UND traege Vergabe beim Lesen, damit auch die PWA ohne
  Migration niemanden unnummeriert laesst. Editierbar mit Pruefung genau
  im eigenen Container - `(container_id, external_id)` ist das Paar.
- Commits: c427801, ad346c7

## 5. Sprachwechsel war tot, Settings bekam eine Sidebar (17:00)

- Original prompt: "Bei den einstellungen sollte ein menu an der linken
  Seite wie in al sein" + "Sprache wechseln tut nichts" + "nur deutsch und
  englisch geht".
- Goal: Navigation wie in adaptive-learner, Sprachen real.
- Result: Der Wechsel war in der deployten App **wirkungslos** - Kataloge
  kamen nur vom Backend, das es auf Pages nicht gibt. Jetzt im Bundle
  (generiert aus derselben YAML, ~7 kB gzip je Sprache, lazy). Danach
  gemessen: es/fr/pt/tr/el/ja waren byte-identische Kopien von en.yaml -
  alle 458 Schluessel uebersetzt, ueber ein Werkzeug mit erzwungener
  Platzhalter-Paritaet statt per Hand. Settings-Sidebar nach AL-Muster:
  ein geteiltes Modell fuer Desktop und Mobil, Paritaet per Test gepinnt.
- Commits: 1f1cca2, 61a6fba, ffd551b

## 6. Ein Button-Bericht, ein systemisches Problem (13:30)

- Original prompt: "Der Button 'Problem melden' sah nicht passend aus" -
  danach "alle buttons und links durchgehen", "die sollen unseren design
  wiederspiegeln".
- Goal: einheitliche Bedienelemente.
- Result: Ursache war strukturell: Tailwinds Preflight ist bewusst aus,
  also setzt nichts die Browser-Styles zurueck - 26 Controls liefen in
  Arial 13,33px, darunter solche mit unseren eigenen `btn`-Klassen (die
  setzen Farbe, nie Schrift). Basis-Regel in `global.css` statt Utility,
  damit eine neue Komponente nicht wieder abdriftet. Danach gemessen: 242
  Controls ueber 12 Ansichten, alle DM Sans, null UA-Chrome.
- Commit: 54f60c8

## 7. ESLint verdrahtet, 37 tote Pakete entfernt (14:00)

- Original prompt: "ESLint: Ja, einrichten" + "und tip-tap auf neueste
  version upgraden" + "Mach noch einen check was noch tote deps da sind".
- Goal: Linter real machen, Ballast weg.
- Result: ESLint war dokumentiert, aber nirgends installiert. Jetzt ESLint
  10 Flat Config, nur Korrektheit. Zur TipTap-Bitte: **27 TipTap-Pakete,
  null Importe, nicht im Bundle** - Upgrade haette nichts gebracht,
  deshalb entfernt statt aktualisiert. Weitere Pruefung fand 10 tote
  Frontend- und 6 tote Backend-Pakete (darunter vier TTS-Engines aus dem
  Hoerbuch-Erbe). node_modules 438 MB -> 367 MB.
- Commits: 0f548ef, 2bced05

## 8. Release v0.2.0 (14:30)

- Original prompt: "v0.2.0 ist korrekt. Release-Workflow fahren."
- Goal: sauberer Release nach `release-workflow.md`.
- Result: Version nur in `backend/pyproject.toml` gesetzt, Rest per
  `make sync-versions`. Gate komplett gruen (Backend 462, Plugin 31,
  Frontend 398, Smoke 15, tsc/ruff/mypy/Hooks sauber, Launcher-Build ok).
  Zwei Funde unterwegs: vier Smoke-Specs beschrieben ueberholtes Verhalten
  (Passphrase-Huerde, ungetabbte Settings) und wurden neu geschrieben;
  der Lock-Pairing-Hook blockierte den Version-Bump als Fehlalarm - die
  eigene Version steht nie in der eigenen poetry.lock, also haette das
  jedes kuenftige Release blockiert. Hook praezisiert (Versionszeile
  ausgenommen, alles andere weiter streng), drei Selbsttests dazu.
  Smoke-Lauf gegen ein Wegwerf-Datenverzeichnis, Pruefsumme der
  Produktiv-DB vorher/nachher identisch.
- Commits: 941410a, 65affd2, bb92d4e, Tag v0.2.0

## Zusammenfassung

- 42 Commits seit v0.1.0, 138 Dateien, Release v0.2.0 veroeffentlicht.
- Tests: Backend 462 (+3), Plugin 31, Frontend 398 (+308 seit v0.1.0),
  Playwright-Smoke 15.
- Abhaengigkeiten: 37 Pakete entfernt, ESLint + Prettier als Hooks
  verdrahtet.
- Deploy laeuft jetzt von `main`, damit der angezeigte Build-Hash dem
  neuesten Commit entspricht.

### Wiederkehrendes Muster dieser Sitzung

Fuenfmal lag die Ursache tiefer als der Bericht: "Foto geht nicht" war
ein geratenes CORS-Flag, "Sprache tut nichts" waren fehlende Kataloge,
"ein Button sieht falsch aus" waren 26 Controls ohne Schriftvererbung,
"TipTap upgraden" war toter Code, "Backend-Tab ist leer" war eine
Komponente, die sich selbst versteckt. Der Reflex, im Browser zu messen
bevor gepatcht wird, hat jedes Mal die richtige Ebene gefunden.

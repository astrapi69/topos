# Dokumentations-Audit: @astrapi69-Pakete

**Stand:** 2026-08-06 · **Erstellt in:** Topos (weil hier bei der
Integrations-Analyse entstanden) · **Gilt fuer:** die Upstream-Repos
`feature-strategy`, `pwa-update-kit`, `ai-key-vault`. Die
Verbesserungsvorschlaege werden dort als Issues umgesetzt, nicht in Topos.

---

## Datengrundlage

Alle 6 Pakete existieren auf npm, MIT, mit `types`-Feld + dualem
ESM/CJS-Build (`.d.ts` + `.d.cts`). Drei GitHub-Monorepos:
`feature-strategy`, `pwa-update-kit`, `ai-key-vault` (alle erreichbar).
Downloads = letzter Monat (2026-07-06 bis 2026-08-04). Die
`.d.ts`-JSDoc-Qualitaet wurde fuer die ai-key-vault-Familie direkt im
installierten Paket geprueft (exzellent: `@param`/`@returns`/`@example`/
`{@link}`); fuer die vier nicht-installierten Pakete stuetzt sich die
Bewertung auf npm-Metadaten + README. Die npm-Website selbst gab 403
(Bot-Block); alle npm-Fakten stammen aus `npm view` + npm-Downloads-API,
die die gerenderten READMEs und Metadaten zuverlaessig abbilden.

---

## Pro-Paket-Bewertung

```
PAKET: @astrapi69/feature-strategy
NPM: https://www.npmjs.com/package/@astrapi69/feature-strategy - vorhanden (v0.1.2, publ. 2026-06-12, 319 Downloads/Monat, MIT)
README: sehr gut - Install, Usage, tiefes Kapitel "defaults plus deviations", Composition-Semantik (hidden>disabled>active), Kosten/Reinheit von Conditions, Strategien-Liste. Fehlt: geschlossene API-Referenztabelle pro Klasse/Methode.
API-Docs: mittel - nur README + mitgelieferte .d.ts-Typen; keine generierte API-Doku-Seite (typedoc), keine Methoden-Tabelle. Typen sind stark generisch (FeatureRegistry<AppContext>).
Beispiele: mittel - nur inline im README (guter, vollstaendiger Quick-Start). Kein examples/-Verzeichnis, kein lauffaehiger Demo/Sandbox (im Repo bestaetigt nicht vorhanden).
Types: gut - types-Feld gesetzt, dualer d.ts/d.cts-Build, streng typisiert. JSDoc-Dichte der .d.ts nicht direkt verifiziert (Paket nicht installiert).
VERBESSERUNGSVORSCHLAEGE:
1. CHANGELOG.md anlegen (fehlt komplett - kein root, kein packages/) und Keep-a-Changelog fuehren wie im ai-key-vault-Repo.
2. API-Referenztabelle ins README (jede Strategy-Klasse + Konstruktor-Signatur + getState/getReason/registerAll), analog zur starken API-Tabelle im pwa-update-core-README.
3. examples/-Ordner mit einem lauffaehigen Minimalprojekt (React + non-React) oder StackBlitz-Link.
```

```
PAKET: @astrapi69/feature-strategy-react
NPM: https://www.npmjs.com/package/@astrapi69/feature-strategy-react - vorhanden (v0.1.2, publ. 2026-06-12, 273 Downloads/Monat, MIT, peer react ^18||^19)
README: sehr gut - Usage mit Provider/useFeature/Feature, dokumentierte useFeature-Rueckgabe {state,isActive,isDisabled,isHidden,reason}, expliziter Memoize-Kontext-Fallstrick, Evaluation-Modell + Bundle-Groesse (~2-3 KB gz). Fehlt: Props-Tabelle fuer <Feature>/<FeatureProvider>.
API-Docs: mittel - README + .d.ts; keine generierte Doku. Komponenten-Props (whenDisabled/whenHidden/render-child) nur im Fliesstext, nicht als Tabelle.
Beispiele: mittel - inline Toolbar-Beispiel gut; kein examples/-Ordner.
Types: gut - types-Feld gesetzt, dualer Build. JSDoc-Dichte nicht direkt verifiziert.
VERBESSERUNGSVORSCHLAEGE:
1. Props-Tabelle fuer <FeatureProvider> (registry, context) und <Feature> (id, whenDisabled, whenHidden, children-as-function).
2. CHANGELOG.md (teilt sich das Repo mit dem Core - eine gemeinsame monorepo-CHANGELOG wuerde beide abdecken).
3. Kurzer SSR/Next.js-Hinweis (Provider re-rendert alle Consumer bei context-Identitaetswechsel) als eigener Abschnitt.
```

```
PAKET: @astrapi69/pwa-update
NPM: https://www.npmjs.com/package/@astrapi69/pwa-update - vorhanden (v0.2.0, publ. 2026-07-21, 434 Downloads/Monat, MIT, 0 dependencies)
README: hervorragend (~8300 Zeichen, bester im Set) - Quick-Start, 3 typische Host-Beduerfnisse (onBeforeApply, manifestUrl:null, polling), 7 dokumentierte Plattform-Quirks je mit Begruendung ("kostete je einen Prod-Incident"), vollstaendige API-Export-Tabelle, Storage-Injektion.
API-Docs: gut - README enthaelt echte API-Tabelle (createUpdateStore, checkForUpdateReliable, activateInBackground, AcceptanceGuard, Helper). Keine separate generierte Doku-Seite, aber README deckt Exports ab.
Beispiele: gut - viele praxisnahe Code-Snippets inline (iOS-Restart, SW-only-Modus, Polling). Kein examples/-Ordner / Demo-App.
Types: gut - types-Feld gesetzt, dualer Build, 0 Runtime-Deps. JSDoc-Dichte nicht direkt verifiziert (nicht installiert), README-Disziplin laesst aber gute Typen erwarten.
VERBESSERUNGSVORSCHLAEGE:
1. CHANGELOG.md anlegen - im gesamten pwa-update-kit-Repo fehlt jede CHANGELOG (root + packages, auf GitHub bestaetigt). Bei crypto-/deploy-nahem Code ist Versionshistorie wichtig.
2. examples/ oder ein minimaler Vite-Demo (das Kit haengt eng an @astrapi69/vite-plugin-build-version - ein End-to-End-Beispiel mit version.json-Emission wuerde Onboarding stark verkuerzen).
3. Migrations-/Kompatibilitaetsnotiz 0.1->0.2 (da ohne CHANGELOG unklar, was sich in 0.2.0 aenderte).
```

```
PAKET: @astrapi69/pwa-update-react
NPM: https://www.npmjs.com/package/@astrapi69/pwa-update-react - vorhanden (v0.2.0, publ. 2026-07-21, 533 Downloads/Monat, MIT, peer react ^18||^19)
README: sehr gut - Quick-Start, Komponenten-Tabelle (UpdateBanner/UpdatePrompt/UpdateCheckControl/VersionCard/lazyWithReload + Hooks), i18n via messages/messagesFromTranslate, Styling ueber semantische Klassen + Button-Slot, iOS-Restart-Hinweis.
API-Docs: gut - Komponenten- und Hook-Tabelle vorhanden; Prop-Details der Slots (variant/size) im Fliesstext. Keine generierte Doku-Seite.
Beispiele: gut - vollstaendiges App-Beispiel + i18n/Styling-Snippets inline. Kein examples/-Ordner.
Types: gut - types-Feld gesetzt, dualer Build. JSDoc-Dichte nicht direkt verifiziert.
VERBESSERUNGSVORSCHLAEGE:
1. CHANGELOG.md (Repo-weit fehlend).
2. Vollstaendige Props-Tabelle fuer UpdatePrompt/VersionCard/UpdateCheckControl (aktuell nur Zweck, nicht die Prop-Signaturen).
3. MESSAGE_KEYS im README explizit auflisten (wird erwaehnt, aber die konkreten i18n-Keys sind nicht dokumentiert - Nutzer muessen sie aus den Typen ziehen).
```

```
PAKET: @astrapi69/ai-key-vault
NPM: https://www.npmjs.com/package/@astrapi69/ai-key-vault - vorhanden (v0.1.1, publ. 2026-07-20, 442 Downloads/Monat, MIT, dep @astrapi69/passphrase-vault gepinnt exakt 0.1.1)
README: sehr gut - Concepts-Abschnitte (Provider-Registry, Storage-Adapter, Encrypted Key Vault, Browser-Direct-Clients, i18n) je mit Code. Etwas knapper (~2500 Zeichen); keine geschlossene API-Tabelle.
API-Docs: sehr gut - hier ausnahmsweise, weil die mitgelieferten .d.ts exzellent mit JSDoc dokumentiert sind (im installierten Paket geprueft: 92 JSDoc-Bloecke auf 570 Zeilen, @param/@returns/@example/{@link}). Faktisch API-Doku ueber IDE-Hover. Keine generierte HTML-Doku.
Beispiele: gut - dichte Concept-Snippets (registry, buildEncryptedKeyVault, aiComplete/aiStream). Kein examples/-Ordner.
Types: sehr gut - types + exports-Map (import/require getrennt), sideEffects:false, ausfuehrliche JSDoc auf Interfaces, Fehlerklassen und Funktionen.
VERBESSERUNGSVORSCHLAEGE:
1. CHANGELOG existiert (root, Keep-a-Changelog, versioniert 0.1.0/0.2.0/0.2.1) - aber wird NICHT ins npm-Tarball gepackt (installierte Kopie hat keine CHANGELOG.md). In "files" aufnehmen oder im README verlinken, damit npm-Nutzer sie sehen.
2. Kompakte API-Referenztabelle ins README (Exports-Uebersicht wie im pwa-update-core-README), da die Oberflaeche gross ist (Registry, Vault, Clients, Discovery, Masking).
3. Ein End-to-End-Beispiel eines AiKeyStoreAdapter (die zentrale Naht, die jeder Consumer implementieren muss) - aktuell nur beschrieben, nicht als vollstaendige Beispiel-Implementierung gezeigt.
```

```
PAKET: @astrapi69/ai-key-vault-react
NPM: https://www.npmjs.com/package/@astrapi69/ai-key-vault-react - vorhanden (v0.1.2, publ. 2026-07-20, 583 Downloads/Monat - hoechste im Set, MIT, peer react ^18||^19)
README: sehr gut - Setup mit allen Provider-Slots (adapter/registry/userId/t/notify/confirm/Button/Input/Link), "What you get", Capabilities-Modell, Peer-Dep. Fehlt: Props-Tabelle je Komponente.
API-Docs: sehr gut - via .d.ts geprueft (47 JSDoc-Bloecke auf 312 Zeilen). IDE-Hover deckt Props/Hooks ab. Keine generierte HTML-Doku.
Beispiele: gut - vollstaendiges Provider-Setup + Capability-Erklaerung inline. Kein examples/-Ordner / Storybook.
Types: sehr gut - types + exports-Map, sideEffects:false, gut dokumentierte Typen.
VERBESSERUNGSVORSCHLAEGE:
1. CHANGELOG ins npm-Tarball (gleiches Problem wie Core - Repo-CHANGELOG deckt beide ab, ist aber im veroeffentlichten Paket nicht enthalten).
2. Props-Tabellen fuer AiSettingsPanel/KeyVaultSection/ApiKeyRow etc. sowie die Rueckgabe-Shapes von useAiKeyStore/useApiKeyStatus.
3. Storybook oder ein Screenshot/GIF der gerenderten Panels - reine BYOK-Settings-UI profitiert stark von visueller Doku; aktuell rein textuell.
```

---

## Querschnitts-Befunde

1. **Groesster gemeinsamer Mangel: keine `examples/`-Verzeichnisse und
   keine generierten API-Doku-Seiten** in keinem der drei Repos. Alle
   Beispiele leben inline im README (durchweg gut geschrieben, aber nicht
   lauffaehig/klonbar).
2. **CHANGELOG-Luecke:** `feature-strategy` und `pwa-update-kit` haben
   **gar keine** CHANGELOG (auf GitHub bestaetigt). `ai-key-vault` hat
   eine vorbildliche (Keep-a-Changelog), aber sie wird **nicht ins
   npm-Paket gepackt** - npm-Nutzer sehen sie nicht.
3. **Staerken:** READMEs sind durchgehend ueberdurchschnittlich (das
   `pwa-update`-Core-README mit den 7 Plattform-Quirks ist herausragend),
   Typen werden ueberall ausgeliefert, und die tatsaechlich inspizierte
   ai-key-vault-Familie hat exzellente JSDoc in den `.d.ts` (faktisch die
   API-Doku via IDE).
4. **Reifegrad:** alles 0.x, niedrige aber reale Download-Zahlen
   (273-583/Monat), aktiv gepflegt (letzte Publikationen Juni/Juli 2026).
5. **Einschraenkung dieser Pruefung:** Fuer `feature-strategy*` und
   `pwa-update*` konnte die JSDoc-Dichte in den `.d.ts` nicht direkt
   gemessen werden (nicht lokal installiert); die Types-Bewertung dort
   stuetzt sich auf npm-Metadaten + README-Disziplin.

---

## Zusammengefasste Issue-Kandidaten pro Repo

**feature-strategy (Repo):**
- CHANGELOG.md (monorepo-weit, deckt Core + React ab).
- API-Referenztabellen in beide READMEs (Core: Strategy-Klassen;
  React: `<FeatureProvider>`/`<Feature>`-Props).
- examples/-Ordner (React + non-React Minimalprojekt).
- SSR/Next.js-Hinweis im React-README.

**pwa-update-kit (Repo):**
- CHANGELOG.md (monorepo-weit).
- examples/ mit End-to-End-Vite-Demo inkl. version.json-Emission.
- Migrationsnotiz 0.1->0.2.
- Props-Tabellen fuer UpdatePrompt/VersionCard/UpdateCheckControl.
- MESSAGE_KEYS explizit im React-README auflisten.

**ai-key-vault (Repo):**
- CHANGELOG ins npm-Tarball packen (`files`-Feld / README-Link).
- API-Referenztabelle im Core-README.
- End-to-End-`AiKeyStoreAdapter`-Beispiel.
- Props-Tabellen im React-README.
- Storybook/Screenshots der Panels.

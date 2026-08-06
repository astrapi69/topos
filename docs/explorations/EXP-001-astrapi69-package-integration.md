# EXP-001: Integration der @astrapi69-Pakete (feature-strategy + pwa-update)

**Kategorie:** Infrastruktur/Frontend · **Phase:** gestuft (pwa-update
zuerst, feature-strategy danach) · **Priorität:** Mittel-Hoch (loest ein
konkretes stale-deploy-Problem auf GitHub Pages) · **Abhängig von:** der
bereits abgeschlossenen `@astrapi69/ai-key-vault`-Integration (gleiches
DI-Slot- und Offline-i18n-Muster) · **Referenz:** `adaptive-learner`
(hat alle vier Pakete produktiv integriert) · **Issue:** —

> Analyse-Dokument mit Umsetzungsplan. Es beschreibt, **wie** Topos vier
> neue `@astrapi69`-Pakete uebernimmt, die in `adaptive-learner` (AL)
> bereits produktiv laufen. Zwei Paar-Bundles: `pwa-update` (+`-react`)
> fuer den Service-Worker-Update-Flow und `feature-strategy` (+`-react`)
> fuer deklarative Feature-Gates. Grundlage: read-only-Inspektion von AL
> und ein npm/GitHub-Doku-Audit (letzterer separat in
> `docs/audit/astrapi69-packages-doc-audit.md`).

---

## 1. Ausgangslage in Topos (Ist-Zustand, verifiziert)

### 1.1 PWA-Update-Muster

- `frontend/src/components/PwaPrompts.tsx` (61 LOC) nutzt
  `useRegisterSW` aus `virtual:pwa-register/react`
  (vite-plugin-pwa, `registerType: "prompt"`). Zeigt eine
  "Neue Version verfuegbar"-Leiste (`data-testid="pwa-update-bar"`,
  `pwa-update-action`) plus einen "App installieren"-Button
  (`data-testid="pwa-install"`, via `usePwaInstall`).
- Gemountet in `frontend/src/App.tsx:61` (`<PwaPrompts />`).
- Test: `frontend/src/components/PwaPrompts.test.tsx` (mockt
  `virtual:pwa-register/react`).
- `frontend/vite.config.ts`: `registerType: "prompt"`, `define`
  liefert `__APP_VERSION__` (aus `package.json`), aber **kein**
  `__BUILD_HASH__`. **Keine** `version.json` wird deployt.

**Bekanntes Problem:** Nach einem GitHub-Pages-Deploy zeigt der
Service-Worker-Cache veraltete Views (stale-deploy). Das aktuelle
`useRegisterSW`-Muster kennt nur "SW wartet", nicht "der deployte Build
ist neuer als der geladene" — es gibt keinen Versions-Manifest-Abgleich.

### 1.2 Ad-hoc-Feature-Gates

Topos hat aktuell **keine** zentrale Feature-Flag-Schicht. Verstreute
ad-hoc-Bedingungen:

- CORS-Gate in `AiProviderSettings.tsx` (`supportsBrowserDirect(id)`,
  nur Anthropic direkt im Browser).
- `requiresBackend`-Logik (OpenAI/Google/custom nur mit Backend).
- Backend-Verfuegbarkeit via `utils/backendStatus.ts`
  (`isBackendAvailable()`), die `useTopos`-Reads gated
  (Dexie-only im Offline-Modus).
- AI-Key-Vorhandensein steuert die Foto-Intake-Bereitschaft.

Diese Bedingungen leben jeweils lokal am Verwendungsort, ohne
gemeinsame Semantik ("warum ist X deaktiviert?") und ohne
Wiederverwendung.

---

## 2. Was die Pakete tun (aus AL-Inspektion)

AL pinnt (`frontend/package.json`):

```json
"@astrapi69/feature-strategy": "^0.1.2",
"@astrapi69/feature-strategy-react": "^0.1.2",
"@astrapi69/pwa-update": "0.2.0",
"@astrapi69/pwa-update-react": "0.2.0",
```

**Zentraler Architektur-Fakt:** AL hat `useRegisterSW` /
`virtual:pwa-register` komplett entfernt. Nur `registerType: "prompt"`
bleibt in `vite.config.ts`; `injectRegister` steht auf Default (`"auto"`),
also injiziert vite-plugin-pwa die SW-Registrierung selbst. `pwa-update`
beobachtet dann diese Registrierung plus den `version.json`-Mismatch.
`pwa-update` **ersetzt** den Hook, kapselt ihn nicht.

### 2.1 `@astrapi69/pwa-update` (Core, non-React)

AL-Nutzung: 2 Dateien.

- `frontend/src/lib/pwa/update-store.ts` (41 LOC): Singleton-Store.
  ```ts
  export const appUpdateStore = createUpdateStore({
    build: CURRENT_BUILD,          // {version: __APP_VERSION__, buildHash: __BUILD_HASH__}
    manifestUrl: versionJsonUrl(), // import.meta.env.BASE_URL + "version.json"
    storageNamespace: "adaptive-learner",
  });
  ```
- `frontend/src/lib/utils/updateChecker.ts` (161 LOC): nutzt
  `checkForUpdateReliable({build, manifestUrl})` nur im Dexie/PWA-Modus;
  im API/Desktop-Modus faellt es auf einen eigenen GitHub-Releases-Check
  zurueck (Paket ungenutzt). Mode-aware.

Voller Export (aus `dist/index.d.ts`): `createUpdateStore`,
`checkForUpdateReliable`, `activateAndReload`, `awaitServiceWorkerUpdate`,
`isChunkLoadError`, `NamespacedStore`, `VersionManifest`,
`UpdateCheckOutcome`. AL nutzt nur die ersten beiden.

### 2.2 `@astrapi69/pwa-update-react`

AL-Nutzung: 4 Prod-Dateien. API: `PwaUpdateProvider`, `UpdateBanner`,
`UpdateCheckControl`, `VersionCard`, `lazyWithReload`, Typ
`UpdateMessages`.

- `components/pwa/AppUpdateProvider.tsx` (71 LOC) — Glue zwischen
  App-i18n, Button-Komponente und Paket:
  ```tsx
  <PwaUpdateProvider store={appUpdateStore} messages={messages} Button={Button} locale={lang}>
  ```
  `buildMessages(t)` mappt bestehende App-i18n-Keys auf das
  `UpdateMessages`-Shape (`bannerMessage`, `apply`, `later`,
  `fullRestartHint`, `checkForUpdates`, `checking`, `updateAvailable`,
  `updatePreparing`, `upToDate`, `checkFailed`, `lastChecked`,
  `neverChecked`, `versionHeading`, `versionLabel`, `buildLabel`,
  `buildDateLabel`). Kein Key-Migrations-Zwang.
- `components/pwa/UpdatePromptHost.tsx` (28 LOC) — gated auf PWA-Modus:
  ```tsx
  if (resolveStorageMode() === "api") return null;
  return <UpdateBanner icon={<RefreshCw size={16} />} />;
  ```
- `components/about/VersionSection.tsx` (49 LOC) — `<VersionCard>` +
  `<UpdateCheckControl>` fuer den About-Screen (nutzt `testIds`-Map,
  damit bestehende E2E-Selektoren weiter greifen).
- `lib/pwa/lazy-route.ts` (20 LOC) — `lazyWithReload` als
  `React.lazy`-Ersatz fuer **alle** Routen: Ein-Schuss-Reload bei
  Chunk-Load-Fehler nach stale Deploy.

### 2.3 `@astrapi69/feature-strategy` (Core, non-React)

AL-Nutzung: 1 Datei — `frontend/src/features/featureConfig.ts` (184 LOC).

- `FEATURES` const-Map (~34 stabile IDs); Call-Sites nie Roh-Strings.
- `FeatureContext = { mode: StorageMode; hasAiKey: boolean }`.
- Gating-Klassen als ID-Listen: `DEFAULT_DISABLED`, `NEEDS_AI_KEY`,
  `DESKTOP_ONLY`.
- Regel-Fabriken geben `FeatureCondition` zurueck
  (`evaluate(ctx) => "active" | "disabled" | undefined`). `undefined` =
  Abstinenz, Descriptor-Default gilt.
- `buildRegistry()`:
  ```ts
  new FeatureRegistry<FeatureContext>()
    .registerAll(descriptors)
    .setStrategy(new ConditionalFeatureStrategy<FeatureContext>(rules));
  ```
- Design: alle Features default `active`; die Strategie traegt nur
  Abweichungsregeln. Reason-Codes `api_key_required`, `desktop_only`.

### 2.4 `@astrapi69/feature-strategy-react`

AL-Nutzung: 11 Dateien. API: `FeatureProvider`, `useFeature`, `Feature`.

- Provider (`App.tsx:167`):
  `<FeatureProvider registry={featureRegistry} context={featureContext}>`,
  Context memoized aus `mode` + `hasAiKey`.
- `useFeature(id)` -> `{ isActive, isDisabled, reason }`.
- Deklarativ: `<Feature id={...} whenDisabled={<Notice/>}>...</Feature>`.
- AL-Wrapper `useFeatureAvailable.ts` (51 LOC) -> `{ available, reason,
  tooltip }`, wobei `tooltip = t(\`feature.${reason}\`, fallback)`.
- Test-Provider `testFeatureProvider.tsx` (59 LOC).

---

## 3. Umsetzungsplan

### Schritt 1: `pwa-update` + `pwa-update-react` (zuerst)

Loest das stale-deploy-Problem, ersetzt `useRegisterSW`.

**Neu:**

1. `vite.config.ts`: `__BUILD_HASH__`-Define ergaenzen (git-Kurzhash
   oder Build-Timestamp) und `version.json` in `dist/` emittieren
   (analog zum bestehenden `spa404Fallback`-Plugin, oder
   `@astrapi69/vite-plugin-build-version` falls verfuegbar).
2. `frontend/src/vite-env.d.ts`: `declare const __BUILD_HASH__: string;`.
3. `frontend/src/pwa/update-store.ts`: `createUpdateStore({build,
   manifestUrl, storageNamespace: "topos"})`.
4. `frontend/src/components/AppUpdateProvider.tsx`: `PwaUpdateProvider`
   mit Topos-`Button`-Slot (aus `ui/classes.ts`) und
   `messages` aus Topos-i18n. **Offline-Fallback** noetig (GitHub Pages
   hat kein Backend-Catalog): gebuendelte DE/EN-Map wie `wrapKitT` bei
   ai-key-vault.
5. `UpdateBanner` einmalig am Root mounten (ersetzt die
   `needRefresh`-Leiste aus `PwaPrompts`). `data-testid`-Kompatibilitaet
   pruefen — falls der Kit andere testids nutzt, Smoke-Test anpassen.
6. Optional: `lazyWithReload` als `React.lazy`-Ersatz fuer die Routen
   in `App.tsx` (Chunk-Reload-Guard).

**Entfernen:** `PwaPrompts.tsx` (nur der `needRefresh`-Teil; der
`usePwaInstall`/"App installieren"-Button ist **nicht** Teil des Kits und
bleibt — entweder in `PwaPrompts` schrumpfen oder in eigene Komponente
extrahieren). `PwaPrompts.test.tsx` entsprechend anpassen.

**Tailwind:** `pwa-update-react` nutzt (wie ai-key-vault-react)
semantische Klassen + inline-Utilities. Content-Glob/Safelist-Fix
wiederholen: eigenes Stylesheet fuer die semantischen Klassen (analog
`ai-key-vault.css`) plus Safelist der template-literal-Utilities.

**Commit:** `feat(frontend): replace useRegisterSW with @astrapi69/pwa-update, add UpdateBanner + lazyWithReload`

### Schritt 2: `feature-strategy` + `feature-strategy-react` (danach)

Konsolidiert die verstreuten ad-hoc-Gates.

**Neu:**

1. `frontend/src/features/featureConfig.ts`: Topos-`FEATURES`-Map,
   `FeatureContext = { backendAvailable: boolean; hasAiKey: boolean }`,
   Gating-Klassen. Kandidaten:
   - `NEEDS_AI_KEY`: Foto-Intake-Analyse, AI-Provider-Features.
   - `NEEDS_BACKEND` (statt AL's `DESKTOP_ONLY`): Excel-Import,
     Settings-Schreibpfade, alle mutierenden `/api`-Aufrufe.
   - `BROWSER_DIRECT_ONLY_ANTHROPIC`: CORS-Gate als Regel statt ad-hoc.
2. `FeatureProvider` in `App.tsx` mounten (innerhalb i18n), Context aus
   `isBackendAvailable()` + AI-Key-Status memoized.
3. Gate-Sites migrieren: Foto-Intake-Button, AI-Panel-Modi,
   Excel-Import-Route auf `useFeature` / `<Feature>` umstellen.

**Entfernen:** die betroffenen ad-hoc-Bedingungen an ihren
Verwendungsorten (durch `useFeature(...)` ersetzt).

**Tailwind:** Content-Glob-Check auch hier (feature-strategy-react ist
klein, primaer Logik; prueft ob es sichtbare Klassen rendert).

**Commit:** `feat(frontend): add feature-strategy with Topos feature gates (ai-key, backend-required)`

### Reihenfolge-Begruendung

pwa-update zuerst, weil es ein akutes, reproduzierbares Problem loest
(stale Deploy) und keine Design-Entscheidungen ueber Topos-Feature-IDs
braucht. feature-strategy danach, weil die Feature-ID-Liste zuerst
durchdacht werden muss und der Nutzen (Aufraeumen) weniger dringend ist.

---

## 4. Muster-Wiederverwendung aus ai-key-vault

Beide Bundles folgen exakt dem Muster der bereits abgeschlossenen
ai-key-vault-Integration:

| Aspekt | ai-key-vault (fertig) | pwa-update / feature-strategy (geplant) |
|---|---|---|
| DI-Slots | `Button`/`Input`/`Link`-Slots aus `ui/classes.ts` | `Button`-Slot bei `PwaUpdateProvider` |
| Offline-i18n | `wrapKitT(t, lang)` gebuendelte DE/EN-Map | `buildMessages(t)` + gebuendelter Fallback |
| Styling | `ai-key-vault.css` fuer semantische Klassen | eigenes Stylesheet fuer pwa-update-react-Klassen |
| Purge-Fix | Tailwind-Safelist der template-literal-Utilities | wiederholen |

Das reduziert das Risiko: die vier offenen Fragen (Slots, i18n, CSS,
Purge) sind schon einmal geloest worden.

---

## 5. Offene Fragen und Annahmen

- **`__BUILD_HASH__`-Quelle:** git-Kurzhash zur Build-Zeit (aus
  `vite.config.ts` via `child_process.execSync("git rev-parse --short
  HEAD")`) ist der naheliegendste Weg; alternativ Build-Timestamp.
  Konservativ: git-Hash, wie AL. **Annahme, im ersten Commit
  festgezurrt.**
- **`version.json`-Emission:** eigenes kleines Vite-Plugin (analog
  `spa404Fallback`) statt einer neuen Dependency
  (`@astrapi69/vite-plugin-build-version`), es sei denn der Nutzer will
  das Paket. **Konservativ: kein neues Paket, eigenes Plugin.**
- **"App installieren"-Button:** bleibt (nicht Kit-Teil). **Annahme:**
  in eigene `PwaInstallButton`-Komponente extrahieren, damit
  `PwaPrompts` sauber verschwindet.
- **Topos-`StorageMode`:** AL hat `dexie`/`api`; Topos-Aequivalent ist
  `backendAvailable` (bool) via `isBackendAvailable()`. **Annahme:** ein
  bool reicht, kein voller Enum noetig.
- **testid-Kompatibilitaet:** ob `UpdateBanner` dieselben testids wie
  `pwa-update-bar` rendert, ist beim Bau zu pruefen; Smoke-Test ggf.
  anpassen.

---

## 6. Ergebnis-Sicherung

Der begleitende npm/GitHub-Doku-Audit aller sechs `@astrapi69`-Pakete
(die vier hier plus `ai-key-vault` + `-react`) liegt in
`docs/audit/astrapi69-packages-doc-audit.md`. Die Verbesserungs-
vorschlaege daraus werden in den jeweiligen Upstream-Repos als Issues
umgesetzt, nicht in Topos.

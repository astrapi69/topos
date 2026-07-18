# Chat-Journal - Session 2026-07-18

## 1. Pre-flight + Hallmark-Audit (11:05)

- Original prompt: Pre-flight (make test, npm run build, npm run test),
  dann `hallmark audit` auf allen 8 Frontend-Seiten; Punch-List mit
  Score, STOP vor Redesign.
- Goal: Vollstaendiges Anti-Slop-Audit des Topos-Frontends als
  Redesign-Grundlage.
- Result:
  - Pre-flight zuerst ROT: flaky unhandled rejection in
    `BackendUrlSettings.test.tsx` (async `handleTest` ueberlebte den
    Test-Teardown, `setTesting(false)` traf ein zerstoertes `window`).
    Fix: drei `waitFor(button not disabled)`-Terminalzustands-Waits.
  - Audit-Kernbefund: zwei halbverbundene Design-Systeme. `global.css`
    traegt ein komplettes Token-System (warm-literary Amber, Font-Paare,
    6 Paletten) aus der bibliogon-Template-Linie; alle Topos-Seiten
    umgingen es mit Tailwind-Festfarben (gray-*/blue-600) plus inline
    `fontFamily: "system-ui"`. Drei konkurrierende Anker (Amber #b45309,
    Blue-600, Blue-800 theme-color).
  - Score (Hallmark-Achsen 1-5): P2 H2 E3 S3 R4 V2.
    2 critical, 9 major, 6 minor. Verdict: "reads as AI-generated"
    (Default-Admin-Look, kein Marketing-Slop).
- Commit: 64adaef (Test-Fix)

## 2. Redesign nach Freigabe (11:15)

- Original prompt: Audit akzeptiert. Nav = Bottom-Tab-Bar mobil,
  Anker = Blue-800, Amber raus. 5 Commits in vorgegebener Gruppierung.
- Goal: Ein Token-System, bewusste Typo-Paarung, daumen-taugliche
  Navigation, Dashboard-Hierarchie, A11y + Konsistenz.
- Result (5 Commits):
  1. **28973ba** Token-Bruecke: `tailwind.config.js theme.extend.colors`
     mappt Token-Utilities auf die CSS-Variablen (`bg-surface`,
     `text-ink`, `border-line`, `bg-accent`, ...); `:root` +
     `[data-theme="dark"]` auf kuehle Slate-Palette mit Blue-800-Anker
     umgezogen (dark: Accent hellt auf #60a5fa auf, `--text-inverse`
     kippt mit - `.btn-primary` blieb dadurch unveraendert korrekt).
     Neues Token `--danger-strong` (konstanter Button-Fill, AA mit
     weissem Text in beiden Modi). `ui/classes.ts` komplett auf
     Token-Klassen; 30 Festfarben-Stellen in Seiten/Komponenten
     gesweept; Import-Dropzone-Hex `#0066cc` -> `var(--accent)`.
     Palette-Registry-Label "Warm Literary" -> "Standard" (id bleibt
     wegen persistiertem localStorage).
  2. **eba9fd2** Typo-Paarung: JetBrains Mono (Display) + DM Sans
     (Body), beide bereits lokal gebundelt - kein CDN. Inline
     `system-ui` von allen 8 `<main>`-Elementen entfernt (jetzt
     `p-4 sm:p-6`, schmale Seiten `max-w-3xl`); globale Type-Scale
     (h1 1.5rem / h2 1.0625rem / h3 0.9375rem, Weight 500 - gebundeltes
     Mono traegt nur 400-500).
  3. **a55c7fb** Bottom-Tab-Bar mobil: 5 Slots (Uebersicht, Container,
     Foto, Suche, Mehr), fixed bottom mit safe-area-inset; "Mehr"-Sheet
     ueber der Bar mit Kategorien/Aktionen/Import/Einstellungen
     (testids `nav-*-mobile` bleiben stabil). Desktop md+: schlanke
     Top-Nav, Hamburger entfaellt, Such-Button nur noch Desktop.
     `#root main` bekommt mobil `padding-bottom` gegen Verdeckung.
     Neuer i18n-Key `topos.nav.more` in allen 8 Katalogen. Neue
     Vitest-Faelle (Tab-Bar, Mehr-Sheet, Such-Tab) + Playwright-Smoke
     `e2e/smoke/bottom-nav.spec.ts` (mobil 390px + Desktop 1280px).
  4. **6faf86e** Dashboard-Hierarchie: asymmetrischer Stat-Block
     (Leitwert Eintraege col-span-3 / text-4xl, drei Sekundaerwerte),
     Werte in Display-Font + tabular-nums. Globales `:focus-visible`
     (2px Accent-Ring, instant). Icon-Konsistenz: Lucide-Chevrons statt
     ASCII "v"/">" (CategoryBrowse) und Unicode-Pfeile (ContainerDetail);
     Actions-Status als `pill` statt "[status]"-Klammertext.
     CategoryBrowse-Touch-Targets auf 44px mobil. Neue i18n-Keys
     `topos.page.categories.expand/collapse` (aria-labels).
  5. **9dd554a** Konsolidierung: gemeinsame `components/FormField.tsx`
     ersetzt die drei lokalen FormField/EditField/Field-Triplets;
     inline-gestylte Formular-Container auf die `card`-Klasse;
     Import-Report auf Token-Klassen.
- Bewusst NICHT gemacht (per Vorgabe): Marketing-Aesthetik, Motion,
  CDN-Fonts. Niedrig priorisiert vertagt: pure-white Cards toenen,
  tabular-nums flaechig, Type-to-confirm beim Container-Delete.
- Verifikation nach jedem Commit: `tsc --noEmit` clean, Vitest gruen,
  `npm run build` gruen; `make test` komplett gruen (Frontend-Vitest
  jetzt 236, +2 durch Nav-Tests); Backend-i18n-Paritaet 75 passed.
  Playwright-Specs geschrieben, Ausfuehrung wie ueblich beim Maintainer
  (laufende App noetig).

## Questions and assumptions

- Desktop-Nav: "schlanke Top-Nav oder Side-Rail, dein Ermessen" ->
  schlanke Top-Nav gewaehlt (kleinster Diff, testid-stabil,
  Side-Rail haette alle Seitenlayouts umgebaut).
- Display-Font: Vorschlag "DM Sans + markanterer Display-Font" ->
  JetBrains Mono gewaehlt (gebundelt, Utility-Stimme, eingebaute
  Tabellenziffern); Crimson Pro/Lora/Source Serif als literarisch
  verworfen.
- Die 5 uebrigen Template-Paletten (cool-modern, nord, classic,
  studio, notebook) blieben stehen: Settings exponiert den
  Palette-Picker ohnehin nicht (toter Code aus der Template-Linie);
  Entfernen waere Scope-Creep gewesen. Kandidat fuer einen
  spaeteren Cleanup-Task.
- `--metadata-tab-min-height` + `.ProseMirror`/TipTap-CSS in
  global.css sind bibliogon-Leftovers - nicht angefasst, gleicher
  Cleanup-Kandidat.

## Summary

- Commits: 6 (1 Test-Fix, 4 Refactor, 1 Feature) + 1 Docs-Commit
- Tests: 236 Vitest (+2), Backend + Plugins gruen, 1 neue
  Playwright-Smoke-Spec (6 Faelle)
- Neue Dateien: `components/FormField.tsx`,
  `e2e/smoke/bottom-nav.spec.ts`
- Hauptergebnis: EIN Design-System (Token-Bruecke), bewusste
  Typo-Paarung, daumen-taugliche Mobile-Nav, sichtbarer
  Keyboard-Fokus ueberall.

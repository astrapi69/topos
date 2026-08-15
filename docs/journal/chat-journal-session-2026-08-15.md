# Chat-Journal 2026-08-15

## 1. tree-kit 0.3.0: ccw-Mutations reviewed, gemerged, publiziert (Vormittag)

- Original prompt: "wir haben mit ccw eine neue version implementiert...
  machen wir weiter" (ccw-Branch claude/tree-api-mutations-3e6vom,
  Commit 45a5754, kein PR, kein Publish, Version noch 0.2.0).
- Goal: die fremde Session zu Ende bringen - Review, Merge, Release.
- Result: Diff gelesen (mutations.ts 307, query.ts 209, fold.ts 61
  Zeilen): Copy-on-write mit Structural Sharing (nur der Edit-Pfad
  realloziert), moveNode mit Zyklen-Schutz und Stale-Cursor-Behandlung,
  flatten als Invers von buildTreeFromFlat. Lokal verifiziert (110
  Tests, tsc, lint, build, beide Beispiele), Version 0.3.0 auf den
  Branch (additiv = minor), PR #6 gemerged, auf npm publiziert, Tag
  diesmal sauber auf dem main-Squash. Doku-Nachzug als PR #7:
  examples/mutations.mjs (ausgefuehrt - Sharing-Identitaet ===,
  Zyklus-Refusal, flatten-Roundtrip) und die Maturity-Sektion ehrlich
  auf DREI Flaechen umgestellt (Mutations: durch Tests und Review
  belegt, noch nicht durch einen Konsumenten).
- Topos: Pin ^0.2.0 -> ^0.3.0 (Caret bindet bei 0.x das Minor),
  bewusst OHNE Nutzung der neuen API - der Baum bleibt Projektion,
  Moves bleiben Flach-Zeilen-Updates. 473 Tests unveraendert gruen.

## 2. AL schliesst seinen latenten Crash (Mittag)

- Original prompt: "ja will ich" (auf das Angebot, den
  onInvalidParent-Einzeiler in adaptive-learner zu setzen).
- Goal: der zweite reale Konsument der Toleranz.
- Result: adaptive-learner#2615 - TopicTree rief buildTreeFromFlat roh
  auf; ein Topic mit haengendem parent_id (Parent geloescht, Kind
  ueberlebte einen Sync) crashte die ganze Curriculum-Ansicht.
  RED-Test zuerst (verwaistes Topic rendert als Root), Einzeiler
  onInvalidParent: "promoteToRoot", Pin ^0.1.0 -> ^0.3.0. 26
  Topic-Tests gruen, tsc sauber, gemerged.
- CI-Reibung, festgehalten: ALs Visual-Baseline-Gate hat ZWEI Labels -
  refresh-visual-baselines RENDERT Baselines, das 0-diff-Escape heisst
  visual-baselines-unaffected. Und Re-Runs nutzen den EINGEFRORENEN
  Event-Payload (Label-Aenderungen unsichtbar) - der frische
  labeled-Event-Lauf zaehlte, mergeStateStatus CLEAN.

## 3. Abschluss-Buchhaltung (Nachmittag)

- Original prompt: "machen wir trotzdem was noch offen ist damit wir
  abschliessen" + zwei qwen-Reviews als Gegenpruefung.
- Result: tree-kit#8 korrigiert die Maturity-Sektion (der
  "latenter-Crash"-Satz ueber AL stimmte nach #2615 nicht mehr; jetzt:
  zwei Anwendungen konsumieren die Toleranz produktiv). Die
  qwen-Zukunftspunkte als Issues verankert statt vergessen:
  tree-kit#9 (merge/diff - 1.0-Kandidaten ohne Aufrufer, bauen beim
  ersten echten Trigger) und tree-kit#10 (orphans-Sammel-Variante von
  onInvalidParent - dritte Variante, kein heutiger Konsument braucht
  sie). qwens uebersehenes cloneSubtree existiert seit #6.
- Offen beim Maintainer: iPhone-Check der Drag-Geste und des
  Verschieben-Menues (gegen den Live-Stand), Muttersprachler-Review,
  Launcher-Hardware-Start. Naechster tree-kit-Meilenstein waere
  Topic-Umhaengen in AL via moveNode - der erste Konsument der
  Mutations-Flaeche.

## Zusammenfassung

- tree-kit: 0.3.0 auf npm; PRs #6-#8 gemerged, Issues #9/#10 als
  ehrliches Backlog; drei Flaechen, zwei davon konsumenten-belegt.
- Topos: Pin ^0.3.0, keine neue API-Nutzung, 473 Tests gruen, live.
- AL: #2615 gemerged, latenter Curriculum-Crash geschlossen.
- Muster der zwei Tage: Lib-Features entstehen aus nachgewiesenem
  Konsum (zweimal derselbe Sanitizer, ein latenter Crash), nie aus
  Review-Wunschlisten - die landen als Issues mit benanntem Trigger.

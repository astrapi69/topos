# Chat-Journal 2026-08-14

## 1. Container-Verschachtelung + Verschieben im Baum (Vormittag)

- Original prompt: "was ich machen wollte ist das ich im Baum items
  oder aeste verschieben kann. wo ist das am besten zu implementieren?
  Hier oder in der lib?" - mit Mid-Flight-Korrektur: "Container ->
  Container ist NICHT verboten... Container-Verschachtelung ist ein
  realer Use Case" (Schema-Erweiterung parent_container_id).
- Goal: Items und Container im Baum verschieben, Container physisch
  verschachteln (Ordner im Regal, Box im Schrank).
- Result: parent_container_id ueber den ganzen Stack - FK mit ON
  DELETE SET NULL (Regal loeschen loest Ordner, loescht sie nicht),
  Alembic-Migration up/down/up auf Datei-DB bewiesen,
  Zyklen-Waechter auf jedem Schreibpfad (API-Service, Dexie, beide
  Excel-Importer), Backup-Import remappt Parent-Referenzen im
  Zweitpass, Excel traegt "Eltern-Nr." (externe Nummer des Parents,
  die einzige DB-uebergreifend stabile Identitaet). Ein paarweise
  geschlossener Workbook-Zyklus (A in B, B in A) wird geschnitten.
  Baum rendert die Verschachtelung; gefilterte Eltern lassen Kinder
  auf ihre Gruppe zurueckfallen, ein Daten-Zyklus degradiert statt
  tree-kit werfen zu lassen. Bewegen ueber EINE Regelquelle
  (canDrop/applyMove) mit zwei Oberflaechen: @dnd-kit-Geste (8px/
  250ms-Hold) und "Verschieben nach..."-Menue als Touch/A11y-Pfad,
  dessen Dialog nur canDrop-genehmigte Ziele anbietet.
- Tests: Backend 469 (+5), Plugin 35 (+2), Frontend 473 (+27),
  Smoke 19 (tree-move nest+detach). Produktiv-DB md5 unveraendert.
- Commits: 606c7df, e7aab7e, 771b24a (Smoke), Docs 669f5b0

## 2. tree-kit 0.2.0: Toleranz wandert in die Lib (Nachmittag)

- Original prompt: "und jetzt da du es implementiert hast kann etwas
  davon in die lib @astrapi69/tree-kit ?" + "entsprechend auch die
  doku fuer die tree-kit ausfuehrlich updaten" + "und ein beispiel in
  tree-kit wenn es noch keins gibt".
- Goal: den generischen Teil der Verschachtelungs-Arbeit in die Lib
  heben.
- Result: Audit fand EIN lib-wuerdiges Stueck mit harter Evidenz -
  Topos hatte denselben Vor-Sanitizer zweimal (categoryTree,
  inventoryTree), adaptive-learner ruft den Builder roh auf (latenter
  Crash bei erster haengender Referenz). tree-kit 0.2.0:
  onInvalidParent: "throw" | "promoteToRoot" in BuildTreeOptions -
  haengende Referenzen und nie terminierende Ketten werden Wurzeln,
  Duplikat-IDs werfen in BEIDEN Modi, Aufloesung memoisiert (O(n)),
  Default unveraendert. 7 neue Pins, 66 Tests gruen. Auf npm
  publiziert; main ist branch-geschuetzt, daher via PR #3 (Feature),
  #4 (README: Matrix, Promotion-Regel, Modus-Leitfaden), #5
  (examples/: happy path + tolerant-view, beide ausgefuehrt und
  Output verifiziert). Topos adoptierte 0.2.0: categoryTree verlor
  seinen Sanitizer ersatzlos (4 Pins unveraendert gruen);
  inventoryTree BEHAELT effectiveParents bewusst - es degradiert zur
  (type, owner)-GRUPPE, nicht zur Wald-Wurzel, eine
  Domaenen-Entscheidung, die die Lib nicht kennen kann; die
  Lib-Option laeuft dort als zweites Netz mit.
- Anmerkung Tag v0.2.0: zeigt auf den inhaltsgleichen
  Pre-Squash-Commit (erster --tags-Push ging durch, main lehnte ab).
  Kein Force-Umhaengen eines publizierten Tags; der Stand ist exakt
  der npm-publizierte Code.
- Commits: Topos 5e77fa2 (Adoption); tree-kit afc57af, a7ac4fc,
  874175e

## Zusammenfassung

- Verschachtelung ist das erste Feature, das den kompletten
  Datenpfad in einer Session zog: Modell, Migration, API, Backup,
  Excel (beide Implementierungen), Dexie, Baum, zwei Bedien-
  Oberflaechen, Smoke.
- tree-kit bekam sein erstes aus echtem Konsum extrahiertes Feature -
  der Weg (zweimal dieselbe Vorarbeit im Konsumenten, ein latenter
  Crash im zweiten Konsumenten) ist genau der Trigger, den die
  ROADMAP-Abwaegung seinerzeit gefordert hatte.
- Offen fuer den Maintainer: iPhone-Check der Drag-Geste (250ms-Hold)
  und des Verschieben-Menues; AL-Seite kann jetzt mit einer Zeile
  (onInvalidParent) ihren latenten Crash schliessen.

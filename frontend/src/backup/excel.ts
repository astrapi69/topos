/**
 * Excel export: build an import-compatible ``.xlsx`` workbook from a
 * Topos backup snapshot, mirroring the backend exporter
 * (``topos_excel_import/exporter.py``): the three Ordner-Ordnung
 * sheets ("Meine Ordner", "Ordner Eltern", "Boxen"), German priority
 * labels, category display paths, and open-action texts.
 *
 * Works in BOTH modes because it renders from the backup snapshot
 * (``exportToposData()``), which is storage-service backed - api mode
 * and the offline Dexie PWA produce the same workbook.
 *
 * exceljs is loaded via dynamic import so the ~1MB library only ships
 * to users who actually click "Excel exportieren"; it never lands in
 * the Settings chunk.
 */

import type { ActionRow, Category, Container, Item } from "../types/topos";
import type { ToposBackup } from "./types";

const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PRIORITY_LABELS: Record<string, string> = {
  very_high: "sehr hoch",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
  none: "keine",
};

type CellValue = string | number | null;
type SheetRows = CellValue[][];

function categoryDisplayPath(
  categories: Map<string, Category>,
  path: string | null,
): string | null {
  if (!path) return null;
  const parts = path.split("/");
  return parts
    .map((part, index) => {
      const prefix = parts.slice(0, index + 1).join("/");
      return categories.get(prefix)?.displayName ?? part;
    })
    .join(" / ");
}

/**
 * Encode one action so status, completion and due date survive the sheet.
 *
 * An open action with no due date stays plain text (what the format
 * always looked like); anything else appends a bracket suffix:
 *   "Prüfen"
 *   "Prüfen [erledigt@2026-01-01]"
 *   "Prüfen [faellig:2026-02-01]"
 *   "Prüfen [archiviert|faellig:2026-02-01]"
 * The importer only treats a bracket as flags when its content parses as
 * known tokens, so an action whose text legitimately ends in brackets is
 * left alone.
 */
function encodeAction(action: ActionRow): string {
  const flags: string[] = [];
  if (action.status !== "open") {
    const label = action.status === "done" ? "erledigt" : "archiviert";
    flags.push(action.completedAt ? `${label}@${action.completedAt}` : label);
  } else if (action.completedAt) {
    flags.push(`erledigt@${action.completedAt}`);
  }
  if (action.dueDate) flags.push(`faellig:${action.dueDate}`);
  return flags.length ? `${action.text} [${flags.join("|")}]` : action.text;
}

/** All actions of an item, encoded; null when the item has none. */
function encodedActions(
  actionsByItem: Map<number, ActionRow[]>,
  itemId: number,
): string | null {
  const encoded = (actionsByItem.get(itemId) ?? [])
    .slice()
    .sort((a, b) => a.id - b.id)
    .map(encodeAction);
  return encoded.length ? encoded.join("; ") : null;
}

/**
 * Folder sheets ("Meine Ordner" / "Ordner Eltern").
 *
 * Columns 0-6 are the original layout; 7-10 were appended so the
 * round-trip loses nothing. Appending (rather than reordering) keeps
 * workbooks written by older versions readable - the importer treats
 * every added column as optional.
 *
 *   0 Nr.  1 Ordner  2 Inhalt  3 Prioritaet  4 Kategorie  5 Ort
 *   6 Aktionen  7 Notizen  8 Kategorie-Pfad  9 Eigentuemer
 *   10 Groessengruppe
 */
function ownerRows(
  containers: Container[],
  itemsByContainer: Map<number, Item[]>,
  actionsByItem: Map<number, ActionRow[]>,
  categories: Map<string, Category>,
): SheetRows {
  const rows: SheetRows = [
    [
      "Nr.",
      "Ordner",
      "Inhalt",
      "Prioritaet",
      "Kategorie",
      "Ort",
      "Aktionen",
      "Notizen",
      "Kategorie-Pfad",
      "Eigentuemer",
      "Groessengruppe",
      "Eintrag-Nr.",
    ],
  ];
  for (const container of containers) {
    rows.push([
      container.externalId,
      container.label,
      null,
      null,
      null,
      container.location,
      null,
      null,
      null,
      container.owner,
      container.sizeGroup,
    ]);
    for (const line of (container.description ?? "").split("\n")) {
      if (line.trim()) rows.push([null, line.trim()]);
    }
    const items = [...(itemsByContainer.get(container.id) ?? [])].sort(
      (a, b) => a.id - b.id,
    );
    for (const item of items) {
      rows.push([
        null,
        null,
        item.content,
        PRIORITY_LABELS[item.priority] ?? "keine",
        categoryDisplayPath(categories, item.categoryPath),
        null,
        encodedActions(actionsByItem, item.id),
        item.notes,
        item.categoryPath,
        null,
        null,
        item.externalId,
      ]);
    }
  }
  return rows;
}

/**
 * Box sheet. Columns 0-5 are the original layout (2 and 3 stay unused so
 * older importers keep finding "Inhalt" at index 4); 6-10 were appended.
 *
 *   0 Nr.  1 Box  2 -  3 -  4 Inhalt  5 Kategorie
 *   6 Aktionen  7 Notizen  8 Kategorie-Pfad  9 Prioritaet  10 Eigentuemer
 */
function boxRows(
  containers: Container[],
  itemsByContainer: Map<number, Item[]>,
  actionsByItem: Map<number, ActionRow[]>,
  categories: Map<string, Category>,
): SheetRows {
  const rows: SheetRows = [
    [
      "Nr.",
      "Box",
      null,
      null,
      "Inhalt",
      "Kategorie",
      "Aktionen",
      "Notizen",
      "Kategorie-Pfad",
      "Prioritaet",
      "Eigentuemer",
      "Eintrag-Nr.",
    ],
  ];
  let currentSizeGroup: string | null = null;
  for (const container of containers) {
    if (container.sizeGroup && container.sizeGroup !== currentSizeGroup) {
      rows.push([container.sizeGroup]);
      currentSizeGroup = container.sizeGroup;
    }
    rows.push([
      container.externalId,
      container.label,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      container.owner,
    ]);
    for (const line of (container.description ?? "").split("\n")) {
      if (line.trim()) rows.push([null, line.trim()]);
    }
    const items = [...(itemsByContainer.get(container.id) ?? [])].sort(
      (a, b) => a.id - b.id,
    );
    for (const item of items) {
      rows.push([
        null,
        null,
        null,
        null,
        item.content,
        categoryDisplayPath(categories, item.categoryPath),
        encodedActions(actionsByItem, item.id),
        item.notes,
        item.categoryPath,
        PRIORITY_LABELS[item.priority] ?? "keine",
        null,
        item.externalId,
      ]);
    }
  }
  return rows;
}

/**
 * Category sheet: the taxonomy verbatim, so slugs, display names and
 * categories no item references survive. Items still carry their own
 * category columns; this sheet is the authority for the tree itself.
 */
function categoryRows(categories: Category[]): SheetRows {
  const rows: SheetRows = [["Pfad", "Anzeigename", "Elternpfad", "Ebene"]];
  for (const category of [...categories].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    rows.push([
      category.path,
      category.displayName,
      category.parentPath,
      category.level,
    ]);
  }
  return rows;
}

/** Widest cell per column decides the width (min 10, max 60 chars). */
function columnWidths(rows: SheetRows): number[] {
  const headerLength = rows[0].length;
  return Array.from({ length: headerLength }, (_, columnIndex) =>
    Math.min(
      rows.reduce((max, row) => {
        const value = row[columnIndex];
        return value == null ? max : Math.max(max, String(value).length + 2);
      }, 10),
      60,
    ),
  );
}

export async function buildExcelBackup(backup: ToposBackup): Promise<Blob> {
  // Dynamic import: exceljs stays out of the eager bundles.
  const excelJsModule = await import("exceljs");
  const ExcelJS = excelJsModule.default ?? excelJsModule;

  const categories = new Map(
    backup.data.categories.map((category) => [category.path, category]),
  );
  const itemsByContainer = new Map<number, Item[]>();
  const actionsByItem = new Map<number, ActionRow[]>();

  for (const item of backup.data.items) {
    const rows = itemsByContainer.get(item.containerId) ?? [];
    rows.push(item);
    itemsByContainer.set(item.containerId, rows);
  }
  for (const action of backup.data.actions) {
    const rows = actionsByItem.get(action.itemId) ?? [];
    rows.push(action);
    actionsByItem.set(action.itemId, rows);
  }

  const containers = [...backup.data.containers].sort(
    (a, b) => a.externalId - b.externalId,
  );
  const ownFolders = containers.filter(
    (container) =>
      container.type === "folder" &&
      (container.owner === "self" || container.owner === "shared"),
  );
  const parentFolders = containers.filter(
    (container) => container.type === "folder" && container.owner === "parents",
  );
  const boxes = containers.filter((container) => container.type === "box");

  const workbook = new ExcelJS.Workbook();
  const sheets: Array<[string, SheetRows]> = [
    [
      "Meine Ordner",
      ownerRows(ownFolders, itemsByContainer, actionsByItem, categories),
    ],
    [
      "Ordner Eltern",
      ownerRows(parentFolders, itemsByContainer, actionsByItem, categories),
    ],
    ["Boxen", boxRows(boxes, itemsByContainer, actionsByItem, categories)],
    ["Kategorien", categoryRows(backup.data.categories)],
  ];
  for (const [name, rows] of sheets) {
    const worksheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    for (const row of rows) worksheet.addRow(row);
    columnWidths(rows).forEach((width, columnIndex) => {
      worksheet.getColumn(columnIndex + 1).width = width;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: MIME_XLSX });
}

export async function downloadExcelBackup(backup: ToposBackup): Promise<void> {
  const blob = await buildExcelBackup(backup);
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `topos-export-${date}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

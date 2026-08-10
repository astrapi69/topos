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

function openActions(
  actionsByItem: Map<number, ActionRow[]>,
  itemId: number,
): string | null {
  const texts = (actionsByItem.get(itemId) ?? [])
    .filter((action) => action.status === "open")
    .sort((a, b) => a.id - b.id)
    .map((action) => action.text);
  return texts.length ? texts.join("; ") : null;
}

function ownerRows(
  containers: Container[],
  itemsByContainer: Map<number, Item[]>,
  actionsByItem: Map<number, ActionRow[]>,
  categories: Map<string, Category>,
  includeActions: boolean,
): SheetRows {
  const rows: SheetRows = [
    ["Nr.", "Ordner", "Inhalt", "Prioritaet", "Kategorie", "Ort", "Aktionen"],
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
        includeActions ? openActions(actionsByItem, item.id) : null,
      ]);
    }
  }
  return rows;
}

function boxRows(
  containers: Container[],
  itemsByContainer: Map<number, Item[]>,
  categories: Map<string, Category>,
): SheetRows {
  const rows: SheetRows = [["Nr.", "Box", null, null, "Inhalt", "Kategorie"]];
  let currentSizeGroup: string | null = null;
  for (const container of containers) {
    if (container.sizeGroup && container.sizeGroup !== currentSizeGroup) {
      rows.push([container.sizeGroup]);
      currentSizeGroup = container.sizeGroup;
    }
    rows.push([container.externalId, container.label]);
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
      ]);
    }
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
      ownerRows(ownFolders, itemsByContainer, actionsByItem, categories, true),
    ],
    [
      "Ordner Eltern",
      ownerRows(
        parentFolders,
        itemsByContainer,
        actionsByItem,
        categories,
        false,
      ),
    ],
    ["Boxen", boxRows(boxes, itemsByContainer, categories)],
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

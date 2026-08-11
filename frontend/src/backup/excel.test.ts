import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildExcelBackup } from "./excel";
import type { ToposBackup } from "./types";

const BACKUP: ToposBackup = {
  format: "topos-backup",
  version: 1,
  exportedAt: "2026-08-10T00:00:00.000Z",
  appVersion: "0.1.0",
  buildHash: "test",
  source: "dexie",
  stats: { containers: 1, items: 1, categories: 2, actions: 1 },
  data: {
    containers: [
      {
        id: 1,
        externalId: 42,
        type: "folder",
        owner: "self",
        label: "Ordner A",
        description: "Beschreibung",
        location: "Regal 1",
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    items: [
      {
        id: 7,
        containerId: 1,
        content: "Versicherung & Vertrag",
        priority: "high",
        categoryPath: "finance/insurance",
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    categories: [
      {
        id: 1,
        path: "finance",
        parentPath: null,
        name: "finance",
        displayName: "Finanzen",
        level: 0,
      },
      {
        id: 2,
        path: "finance/insurance",
        parentPath: "finance",
        name: "insurance",
        displayName: "Versicherung",
        level: 1,
      },
    ],
    actions: [
      {
        id: 9,
        itemId: 7,
        text: "Prüfen",
        status: "open",
        dueDate: null,
        createdAt: "",
        completedAt: null,
      },
    ],
  },
};

async function readWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

describe("buildExcelBackup", () => {
  it("builds an xlsx package with the import-compatible sheets", async () => {
    const blob = await buildExcelBackup(BACKUP);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const workbook = await readWorkbook(blob);
    // "Kategorien" carries the taxonomy verbatim so slugs, display names
    // and unreferenced categories survive a round-trip.
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Meine Ordner",
      "Ordner Eltern",
      "Boxen",
      "Kategorien",
    ]);
  });

  it("writes the item row with priority label, category path and actions", async () => {
    const workbook = await readWorkbook(await buildExcelBackup(BACKUP));
    const sheet = workbook.getWorksheet("Meine Ordner");
    expect(sheet).toBeDefined();

    let itemRow: ExcelJS.Row | undefined;
    sheet?.eachRow((row) => {
      if (row.getCell(3).value === "Versicherung & Vertrag") itemRow = row;
    });
    expect(itemRow).toBeDefined();
    expect(itemRow?.getCell(4).value).toBe("hoch");
    expect(itemRow?.getCell(5).value).toBe("Finanzen / Versicherung");
    expect(itemRow?.getCell(7).value).toBe("Prüfen");
  });

  it("writes the container row and header, and freezes the header row", async () => {
    const workbook = await readWorkbook(await buildExcelBackup(BACKUP));
    const sheet = workbook.getWorksheet("Meine Ordner");
    expect(sheet?.getRow(1).getCell(1).value).toBe("Nr.");
    expect(sheet?.getRow(1).getCell(2).value).toBe("Ordner");
    expect(sheet?.getRow(2).getCell(1).value).toBe(42);
    expect(sheet?.getRow(2).getCell(2).value).toBe("Ordner A");
    expect(sheet?.getRow(2).getCell(6).value).toBe("Regal 1");
    expect(sheet?.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("keeps parent folders and boxes on their own sheets", async () => {
    const backup: ToposBackup = {
      ...BACKUP,
      data: {
        ...BACKUP.data,
        containers: [
          ...BACKUP.data.containers,
          {
            id: 2,
            externalId: 7,
            type: "folder",
            owner: "parents",
            label: "Eltern Ordner",
            description: null,
            location: null,
            sizeGroup: null,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: 3,
            externalId: 100,
            type: "box",
            owner: "self",
            label: "Box A",
            description: null,
            location: null,
            sizeGroup: "100 bis 199",
            createdAt: "",
            updatedAt: "",
          },
        ],
      },
    };
    const workbook = await readWorkbook(await buildExcelBackup(backup));
    const parents = workbook.getWorksheet("Ordner Eltern");
    expect(parents?.getRow(2).getCell(2).value).toBe("Eltern Ordner");
    const boxes = workbook.getWorksheet("Boxen");
    // The size-group heading precedes the box row (import-parser contract).
    expect(boxes?.getRow(2).getCell(1).value).toBe("100 bis 199");
    expect(boxes?.getRow(3).getCell(1).value).toBe(100);
    expect(boxes?.getRow(3).getCell(2).value).toBe("Box A");
  });
});

/**
 * Import -> export round-trip fidelity, measured and pinned.
 *
 * Two questions this answers, both by measurement rather than claim:
 *
 * 1. Can the two workbooks be compared by checksum? No. xlsx is a ZIP,
 *    and exceljs stamps entry timestamps, so exporting the SAME data
 *    twice yields different bytes. Comparing file digests would report
 *    a difference that does not exist. The meaningful comparison is a
 *    digest over the extracted cell matrix, which this file uses.
 *
 * 2. Is the round-trip lossless? Yes. The sheet layout was extended
 *    (owner, notes, category slug, box priority, action status/dates,
 *    plus a "Kategorien" sheet) so every field the model carries has a
 *    column. Export -> import -> export reproduces identical content.
 *
 * The added columns are appended, never reordered, so a workbook from
 * an older version still imports - the last test pins that too.
 */

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildExcelBackup } from "../backup/excel";
import { importWorkbook } from "./importWorkbook";
import type { ToposBackup } from "../backup/types";
import type { IStorageService } from "../storage/types";
import type { ActionRow, Category, Container, Item } from "../types/topos";

/** In-memory IStorageService double: only what the importer touches. */
function fakeStorage() {
  const containers: Container[] = [];
  const items: Item[] = [];
  const categories: Category[] = [];
  const actions: ActionRow[] = [];
  let nextId = 1;

  const service = {
    mode: "dexie",
    containers: {
      list: async () => [...containers],
      create: async (payload: Record<string, unknown>) => {
        const row = {
          id: nextId++,
          description: null,
          location: null,
          sizeGroup: null,
          createdAt: "",
          updatedAt: "",
          ...payload,
        } as Container;
        containers.push(row);
        return row;
      },
      update: async (id: number, payload: Record<string, unknown>) => {
        const row = containers.find((c) => c.id === id) as Container;
        Object.assign(row, payload);
        return row;
      },
    },
    items: {
      list: async (filters?: { containerId?: number }) =>
        filters?.containerId === undefined
          ? [...items]
          : items.filter((i) => i.containerId === filters.containerId),
      create: async (payload: Record<string, unknown>) => {
        const row = {
          id: nextId++,
          priority: "none",
          categoryPath: null,
          notes: null,
          createdAt: "",
          updatedAt: "",
          ...payload,
        } as Item;
        items.push(row);
        return row;
      },
      update: async (id: number, payload: Record<string, unknown>) => {
        const row = items.find((i) => i.id === id) as Item;
        Object.assign(row, payload);
        return row;
      },
      delete: async (id: number) => {
        items.splice(
          items.findIndex((i) => i.id === id),
          1,
        );
      },
    },
    categories: {
      list: async () => [...categories],
      create: async (payload: Record<string, unknown>) => {
        const row = { id: nextId++, ...payload } as Category;
        categories.push(row);
        return row;
      },
    },
    actions: {
      list: async () => [...actions],
      create: async (payload: Record<string, unknown>) => {
        const row = {
          id: nextId++,
          status: "open",
          dueDate: null,
          createdAt: "",
          completedAt: null,
          ...payload,
        } as ActionRow;
        actions.push(row);
        return row;
      },
    },
  } as unknown as IStorageService;

  return { service, containers, items, categories, actions };
}

/** Covers one case per field the sheet format can or cannot carry. */
const SOURCE: ToposBackup = {
  format: "topos-backup",
  version: 1,
  exportedAt: "2026-08-10T00:00:00.000Z",
  appVersion: "0.1.0",
  buildHash: "test",
  source: "dexie",
  stats: { containers: 4, items: 5, categories: 3, actions: 3 },
  data: {
    containers: [
      {
        id: 1,
        externalId: 10,
        type: "folder",
        owner: "self",
        label: "Selbst",
        description: "Zeile1\nZeile2",
        location: "Regal 1",
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 2,
        externalId: 20,
        type: "folder",
        owner: "shared",
        label: "Geteilt",
        description: null,
        location: "Keller",
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 3,
        externalId: 30,
        type: "folder",
        owner: "parents",
        label: "Eltern",
        description: null,
        location: "Dachboden",
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 4,
        externalId: 40,
        type: "box",
        owner: "self",
        label: "Kiste",
        description: null,
        location: null,
        sizeGroup: "40 bis 49",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 5,
        externalId: 50,
        type: "drawer",
        owner: "self",
        label: "Kommode 3",
        description: null,
        location: null,
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 6,
        externalId: 51,
        type: "safe",
        owner: "parents",
        label: "Tresor",
        description: null,
        location: null,
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    items: [
      {
        id: 101,
        containerId: 1,
        externalId: 1,
        content: "Mit Notiz",
        priority: "high",
        categoryPath: "finance/insurance",
        notes: "wichtige Notiz",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 102,
        containerId: 1,
        externalId: 2,
        content: "Sonderslug",
        priority: "low",
        categoryPath: "custom-slug",
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 103,
        containerId: 2,
        externalId: 1,
        content: "Geteilt-Eintrag",
        priority: "medium",
        categoryPath: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 104,
        containerId: 3,
        externalId: 1,
        content: "Eltern-Eintrag",
        priority: "very_high",
        categoryPath: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 105,
        containerId: 4,
        externalId: 4,
        content: "Box-Eintrag",
        priority: "high",
        categoryPath: null,
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
      {
        id: 3,
        path: "custom-slug",
        parentPath: null,
        name: "custom-slug",
        displayName: "Sonderfall",
        level: 0,
      },
    ],
    actions: [
      {
        id: 201,
        itemId: 101,
        text: "Offen",
        status: "open",
        dueDate: null,
        createdAt: "",
        completedAt: null,
      },
      {
        id: 202,
        itemId: 101,
        text: "Erledigt",
        status: "done",
        dueDate: null,
        createdAt: "",
        completedAt: "2026-01-01",
      },
      {
        id: 203,
        itemId: 104,
        text: "Eltern-Aktion",
        status: "open",
        dueDate: null,
        createdAt: "",
        completedAt: null,
      },
    ],
  },
};

function fileDigest(buffer: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

/** Digest over the extracted cell matrix - ignores ZIP metadata. */
async function contentDigest(buffer: ArrayBuffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = workbook.worksheets.map((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    return { name: sheet.name, rows };
  });
  return createHash("sha256").update(JSON.stringify(sheets)).digest("hex");
}

function backupOf(store: ReturnType<typeof fakeStorage>): ToposBackup {
  return {
    ...SOURCE,
    data: {
      containers: store.containers,
      items: store.items,
      categories: store.categories,
      actions: store.actions,
    },
  };
}

async function exportBytes(backup: ToposBackup): Promise<ArrayBuffer> {
  return (await buildExcelBackup(backup)).arrayBuffer();
}

/** A workbook in the pre-extension layout (7 / 6 columns, no extras). */
async function legacyWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const mine = workbook.addWorksheet("Meine Ordner");
  mine.addRow([
    "Nr.",
    "Ordner",
    "Inhalt",
    "Prioritaet",
    "Kategorie",
    "Ort",
    "Aktionen",
  ]);
  mine.addRow([10, "Selbst", null, null, null, "Regal 1", null]);
  mine.addRow([
    null,
    null,
    "Alt",
    "hoch",
    "Finanzen / Versicherung",
    null,
    "Alte Aktion",
  ]);
  const parents = workbook.addWorksheet("Ordner Eltern");
  parents.addRow([
    "Nr.",
    "Ordner",
    "Inhalt",
    "Prioritaet",
    "Kategorie",
    "Ort",
    "Aktionen",
  ]);
  parents.addRow([30, "Eltern", null, null, null, null, null]);
  const boxes = workbook.addWorksheet("Boxen");
  boxes.addRow(["Nr.", "Box", null, null, "Inhalt", "Kategorie"]);
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Export -> import -> export, returning both workbooks and the store. */
async function cycle() {
  const first = await exportBytes(SOURCE);
  const store = fakeStorage();
  await importWorkbook(first, store.service);
  const second = await exportBytes(backupOf(store));
  return { first, second, store };
}

describe("Excel round-trip fidelity", () => {
  it("cannot be compared by file checksum: identical data, different bytes", async () => {
    const once = await exportBytes(SOURCE);
    // The ZIP entry timestamps move; one second is enough to see it.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const twice = await exportBytes(SOURCE);

    expect(fileDigest(once)).not.toBe(fileDigest(twice));
    // The content is what actually matters, and it is stable.
    expect(await contentDigest(once)).toBe(await contentDigest(twice));
  });

  it("is lossless: one cycle reproduces the identical workbook content", async () => {
    const { first, second, store } = await cycle();

    // The whole point: export -> import -> export changes nothing.
    expect(await contentDigest(second)).toBe(await contentDigest(first));

    // And it stays that way on a further cycle.
    const reimported = fakeStorage();
    await importWorkbook(second, reimported.service);
    const third = await exportBytes(backupOf(reimported));
    expect(await contentDigest(third)).toBe(await contentDigest(first));

    expect(store.containers).toHaveLength(6);
    expect(store.items).toHaveLength(5);
  });

  it("preserves the fields the sheet format carries", async () => {
    const { store } = await cycle();
    const byExternalId = (externalId: number) =>
      store.containers.find((container) => container.externalId === externalId);

    expect(byExternalId(10)).toMatchObject({
      type: "folder",
      label: "Selbst",
      location: "Regal 1",
      description: "Zeile1\nZeile2", // multi-row description survives
    });
    expect(byExternalId(40)).toMatchObject({
      type: "box",
      label: "Kiste",
      sizeGroup: "40 bis 49",
    });
    expect(byExternalId(30)).toMatchObject({ owner: "parents" });

    const item = (content: string) =>
      store.items.find((row) => row.content === content);
    // Priority and a mapped category survive on the folder sheets.
    expect(item("Mit Notiz")).toMatchObject({
      priority: "high",
      categoryPath: "finance/insurance",
    });
    expect(item("Eltern-Eintrag")).toMatchObject({ priority: "very_high" });
    // Open actions on "Meine Ordner" survive.
    expect(store.actions.map((action) => action.text)).toContain("Offen");
  });

  it("round-trips the curated non-folder types via the Typ column", async () => {
    // drawer/shelf/case/safe share the Boxen sheet (owner is a column
    // there); the appended Typ cell wins on import, an empty one keeps
    // the sheet default - so the legacy-workbook test below still holds.
    const { store } = await cycle();
    const byExternalId = (externalId: number) =>
      store.containers.find((container) => container.externalId === externalId);

    expect(byExternalId(50)).toMatchObject({ type: "drawer", owner: "self" });
    expect(byExternalId(51)).toMatchObject({ type: "safe", owner: "parents" });
    expect(byExternalId(40)).toMatchObject({ type: "box" });
  });

  it("carries the fields older layouts had no column for", async () => {
    const { store } = await cycle();
    const item = (content: string) =>
      store.items.find((row) => row.content === content);
    const container = (externalId: number) =>
      store.containers.find((row) => row.externalId === externalId);

    // owner "shared" is explicit now, not implied by the sheet.
    expect(container(20)?.owner).toBe("shared");
    // "Ordner Eltern" carries a location column.
    expect(container(30)?.location).toBe("Dachboden");
    // Item notes have a column.
    expect(item("Mit Notiz")?.notes).toBe("wichtige Notiz");
    // The slug travels next to the German display path, so a slug that is
    // not derivable from its display name survives verbatim.
    expect(item("Sonderslug")?.categoryPath).toBe("custom-slug");
    // "Boxen" carries priority.
    expect(item("Box-Eintrag")?.priority).toBe("high");
    // The per-container item number survives, so a printed "42-3" label
    // still matches after a round-trip.
    expect(item("Mit Notiz")?.externalId).toBe(1);
    expect(item("Sonderslug")?.externalId).toBe(2);
    expect(item("Box-Eintrag")?.externalId).toBe(4);
    // Every action survives with its status, on every sheet.
    expect(
      store.actions.map((action) => `${action.text}:${action.status}`).sort(),
    ).toEqual(["Eltern-Aktion:open", "Erledigt:done", "Offen:open"]);
    expect(
      store.actions.find((action) => action.text === "Erledigt")?.completedAt,
    ).toBe("2026-01-01");
  });

  it("still reads a legacy workbook without the added columns", async () => {
    // Files exported before the layout grew must keep importing: the
    // added columns are optional, the old semantics are the fallback.
    const legacy = await legacyWorkbook();
    const store = fakeStorage();
    await importWorkbook(legacy, store.service);

    expect(
      store.containers.map((row) => row.externalId).sort((a, b) => a - b),
    ).toEqual([10, 30]);
    // Owner comes from the sheet when no owner column is present.
    expect(store.containers.find((c) => c.externalId === 10)?.owner).toBe(
      "self",
    );
    expect(store.containers.find((c) => c.externalId === 30)?.owner).toBe(
      "parents",
    );
    // Category falls back to slugifying the German display path.
    expect(store.items.find((i) => i.content === "Alt")?.categoryPath).toBe(
      "finance/insurance",
    );
    expect(store.actions.map((a) => a.text)).toEqual(["Alte Aktion"]);
  });
});

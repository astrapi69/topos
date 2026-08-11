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
 * 2. Is the round-trip lossless? No, not on the first cycle - and the
 *    losses are structural, not bugs: the Ordner-Ordnung sheet layout
 *    has no column for several Topos fields. After one cycle the
 *    workbook is a FIXED POINT (import -> export reproduces the exact
 *    same content), so data stops degrading; the loss happens once, on
 *    the way into the sheet format.
 *
 * Every loss below is asserted deliberately. If a future change makes
 * one of them lossless, this test fails and the expectation moves - it
 * is a ratchet, not a description.
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
    ],
    items: [
      {
        id: 101,
        containerId: 1,
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

  it("reaches a fixed point after one cycle", async () => {
    const { first, second, store } = await cycle();

    // First cycle loses what the sheet format cannot carry (see below).
    expect(await contentDigest(first)).not.toBe(await contentDigest(second));

    // Second cycle changes nothing further: no ongoing degradation.
    const reimported = fakeStorage();
    await importWorkbook(second, reimported.service);
    const third = await exportBytes(backupOf(reimported));
    expect(await contentDigest(third)).toBe(await contentDigest(second));

    // The store is what the workbook can represent, nothing dropped silently.
    expect(store.containers).toHaveLength(4);
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

  it("pins the structural losses of the Ordner-Ordnung format", async () => {
    const { store } = await cycle();
    const item = (content: string) =>
      store.items.find((row) => row.content === content);

    // owner "shared" shares the "Meine Ordner" sheet with "self" and comes
    // back as "self" - the sheet encodes the owner, and there are only two.
    expect(
      store.containers.find((container) => container.externalId === 20)?.owner,
    ).toBe("self");

    // "Ordner Eltern" has no location column, so a parents location is lost.
    expect(
      store.containers.find((container) => container.externalId === 30)
        ?.location,
    ).toBeNull();

    // No sheet has a notes column: item notes never reach the workbook.
    expect(item("Mit Notiz")?.notes).toBeNull();

    // A category slug that is not derivable from its display name is
    // re-derived on import: the sheet stores "Sonderfall", not the slug.
    expect(item("Sonderslug")?.categoryPath).toBe("sonderfall");

    // "Boxen" has no priority column: box items come back as "none".
    expect(item("Box-Eintrag")?.priority).toBe("none");

    // Only OPEN actions are exported, and only on "Meine Ordner": the done
    // action and the parents-sheet action do not survive.
    expect(store.actions.map((action) => action.text)).toEqual(["Offen"]);
  });
});

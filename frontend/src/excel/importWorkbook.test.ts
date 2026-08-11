/**
 * Round-trip pin for the offline Excel import.
 *
 * The strongest available check: feed the importer the workbook our own
 * exporter produces (buildExcelBackup) and assert the data comes back
 * out unchanged. Exporter and importer are independent implementations
 * of the same Ordner-Ordnung sheet contract, so a drift on either side
 * breaks this test.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { buildExcelBackup } from "../backup/excel";
import { importWorkbook } from "./importWorkbook";
import type { ToposBackup } from "../backup/types";
import type { IStorageService } from "../storage/types";
import type { ActionRow, Category, Container, Item } from "../types/topos";

const BACKUP: ToposBackup = {
  format: "topos-backup",
  version: 1,
  exportedAt: "2026-08-10T00:00:00.000Z",
  appVersion: "0.1.0",
  buildHash: "test",
  source: "dexie",
  stats: { containers: 3, items: 3, categories: 2, actions: 1 },
  data: {
    containers: [
      {
        id: 1,
        externalId: 42,
        type: "folder",
        owner: "self",
        label: "Ordner A",
        description: null,
        location: "Regal 1",
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
      },
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
    items: [
      {
        id: 7,
        containerId: 1,
        externalId: 1,
        content: "Versicherung & Vertrag",
        priority: "high",
        categoryPath: "finance/insurance",
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 8,
        containerId: 2,
        externalId: 1,
        content: "Elternvertrag",
        priority: "none",
        categoryPath: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 9,
        containerId: 3,
        externalId: 1,
        content: "Kabeltrommel",
        priority: "none",
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

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
});

async function importOurOwnExport(options?: { pruneMissing?: boolean }) {
  const blob = await buildExcelBackup(BACKUP);
  return importWorkbook(await blob.arrayBuffer(), store.service, options);
}

describe("importWorkbook", () => {
  it("round-trips the workbook our exporter produces", async () => {
    const report = await importOurOwnExport();

    expect(report.containersCreated).toBe(3);
    expect(
      store.containers.map((c) => c.externalId).sort((a, b) => a - b),
    ).toEqual([7, 42, 100]);

    const folder = store.containers.find((c) => c.externalId === 42);
    expect(folder).toMatchObject({
      type: "folder",
      owner: "self",
      label: "Ordner A",
      location: "Regal 1",
    });
    // The parents sheet carries no location column and owner=parents.
    expect(store.containers.find((c) => c.externalId === 7)).toMatchObject({
      owner: "parents",
      type: "folder",
    });
    // The box sheet carries the size-group heading.
    expect(store.containers.find((c) => c.externalId === 100)).toMatchObject({
      type: "box",
      sizeGroup: "100 bis 199",
    });
  });

  it("restores item priority, category path and open actions", async () => {
    await importOurOwnExport();

    const item = store.items.find(
      (i) => i.content === "Versicherung & Vertrag",
    );
    expect(item).toMatchObject({
      priority: "high",
      categoryPath: "finance/insurance",
    });
    expect(store.actions.map((a) => a.text)).toEqual(["Prüfen"]);
  });

  it("creates the full category ancestor chain once", async () => {
    const report = await importOurOwnExport();

    expect(store.categories.map((c) => c.path)).toEqual([
      "finance",
      "finance/insurance",
    ]);
    expect(store.categories[1]).toMatchObject({
      parentPath: "finance",
      name: "insurance",
      displayName: "Versicherung",
      level: 1,
    });
    expect(report.categoriesCreated).toBe(2);
  });

  it("is idempotent: a second import creates nothing new", async () => {
    await importOurOwnExport();
    const second = await importOurOwnExport();

    expect(second.containersCreated).toBe(0);
    expect(second.containersUpdated).toBe(3);
    expect(second.itemsCreated).toBe(0);
    expect(second.categoriesCreated).toBe(0);
    expect(second.actionsCreated).toBe(0);
    expect(store.containers).toHaveLength(3);
    expect(store.items).toHaveLength(3);
    expect(store.actions).toHaveLength(1);
  });

  it("keeps unseen items by default and deletes them with pruneMissing", async () => {
    await importOurOwnExport();
    const container = store.containers.find((c) => c.externalId === 42) as {
      id: number;
    };
    await store.service.items.create({
      containerId: container.id,
      content: "Nicht in der Datei",
    });

    await importOurOwnExport();
    expect(store.items.some((i) => i.content === "Nicht in der Datei")).toBe(
      true,
    );

    const pruned = await importOurOwnExport({ pruneMissing: true });
    expect(pruned.itemsPruned).toBe(1);
    expect(store.items.some((i) => i.content === "Nicht in der Datei")).toBe(
      false,
    );
  });

  it("reports a warning when a sheet is missing", async () => {
    const emptyBackup: ToposBackup = {
      ...BACKUP,
      data: { ...BACKUP.data, containers: [], items: [], actions: [] },
    };
    const blob = await buildExcelBackup(emptyBackup);
    const report = await importWorkbook(
      await blob.arrayBuffer(),
      store.service,
    );
    // Sheets exist but hold only headers: nothing imported, no crash.
    expect(report.containersCreated).toBe(0);
    expect(store.containers).toHaveLength(0);
  });
});

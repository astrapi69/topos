import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "../db/schema";
import type { ActionRow, Category, Container, Item } from "../types/topos";
import { importToposData, validateBackup } from "./import";
import {
  BackupValidationError,
  type ToposBackup,
  type ToposBackupData,
} from "./types";

vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: () => Promise.resolve(false),
}));
vi.mock("../search/buildIndex", () => ({
  rebuildSearchIndex: vi.fn(async () => undefined),
}));

const CONTAINER: Container = {
  id: 1,
  externalId: 9001,
  type: "box",
  owner: "self",
  label: "Box A",
  description: null,
  location: null,
  sizeGroup: null,
  createdAt: "",
  updatedAt: "",
};
const ITEM: Item = {
  id: 1,
  containerId: 1,
  externalId: 1,
  content: "Invoice",
  priority: "none",
  categoryPath: null,
  notes: null,
  createdAt: "",
  updatedAt: "",
};
const CATEGORY: Category = {
  id: 1,
  path: "finance",
  parentPath: null,
  name: "finance",
  displayName: "Finanzen",
  level: 0,
};
const ACTION: ActionRow = {
  id: 1,
  itemId: 1,
  text: "review",
  status: "open",
  dueDate: null,
  createdAt: "",
  completedAt: null,
};

function backupOf(data: Partial<ToposBackupData>): ToposBackup {
  const full: ToposBackupData = {
    containers: data.containers ?? [],
    items: data.items ?? [],
    categories: data.categories ?? [],
    actions: data.actions ?? [],
  };
  return {
    format: "topos-backup",
    version: 1,
    exportedAt: "",
    appVersion: "",
    buildHash: "",
    source: "dexie",
    data: full,
    stats: {
      containers: full.containers.length,
      items: full.items.length,
      categories: full.categories.length,
      actions: full.actions.length,
    },
  };
}

beforeEach(async () => {
  await Promise.all([
    db.containers.clear(),
    db.items.clear(),
    db.categories.clear(),
    db.actions.clear(),
  ]);
});

describe("validateBackup", () => {
  it("accepts a well-formed envelope", () => {
    const backup = validateBackup(backupOf({ containers: [CONTAINER] }));
    expect(backup.data.containers[0].externalId).toBe(9001);
  });

  it("rejects a foreign format", () => {
    expect(() =>
      validateBackup({ format: "other", version: 1, data: {} }),
    ).toThrow(BackupValidationError);
  });

  it("rejects an unsupported version", () => {
    try {
      validateBackup({ format: "topos-backup", version: 2, data: {} });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BackupValidationError);
      expect((err as BackupValidationError).code).toBe("unsupported_version");
    }
  });

  it("rejects a non-object", () => {
    expect(() => validateBackup([])).toThrow(BackupValidationError);
    expect(() => validateBackup(null)).toThrow(BackupValidationError);
  });
});

describe("importToposData (dexie path)", () => {
  it("replace clears existing data then inserts the backup", async () => {
    await db.containers.bulkPut([
      { ...CONTAINER, id: 99, externalId: 1, label: "Old" },
    ]);
    const result = await importToposData(
      backupOf({
        containers: [CONTAINER],
        items: [ITEM],
        categories: [CATEGORY],
        actions: [ACTION],
      }),
      "replace",
    );
    expect(result.imported).toBe(4);
    const externals = (await db.containers.toArray()).map((c) => c.externalId);
    expect(externals).toEqual([9001]); // the old external_id 1 is gone
  });

  it("merge dedups items by (containerId, content)", async () => {
    await db.containers.bulkPut([CONTAINER]);
    await db.items.bulkPut([ITEM]); // same (containerId, content) as the backup item
    const result = await importToposData(
      backupOf({ containers: [CONTAINER], items: [ITEM] }),
      "merge",
    );
    // container upserted (1), item is a duplicate -> skipped.
    expect(result.skipped).toBe(1);
    expect(await db.items.count()).toBe(1);
  });

  it("merge upserts a container by externalId without duplicating", async () => {
    await db.containers.bulkPut([{ ...CONTAINER, id: 50, label: "Original" }]);
    await importToposData(backupOf({ containers: [CONTAINER] }), "merge");
    const matches = (await db.containers.toArray()).filter(
      (c) => c.externalId === 9001,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe("Box A");
  });
});

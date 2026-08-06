import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "../db/schema";
import { buildBackup, exportToposData } from "./export";
import { BACKUP_FORMAT, BACKUP_VERSION } from "./types";

// Offline path: exportToposData reads Dexie directly.
vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: () => Promise.resolve(false),
}));

beforeEach(async () => {
  await Promise.all([
    db.containers.clear(),
    db.items.clear(),
    db.categories.clear(),
    db.actions.clear(),
  ]);
});

const CONTAINER = {
  id: 1,
  externalId: 9001,
  type: "box" as const,
  owner: "self" as const,
  label: "Box A",
  description: null,
  location: null,
  sizeGroup: null,
  createdAt: "",
  updatedAt: "",
};

describe("buildBackup", () => {
  it("wraps data in a versioned envelope with matching stats", () => {
    const backup = buildBackup(
      { containers: [CONTAINER], items: [], categories: [], actions: [] },
      "dexie",
    );
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.source).toBe("dexie");
    expect(backup.stats).toEqual({
      containers: 1,
      items: 0,
      categories: 0,
      actions: 0,
    });
  });
});

describe("exportToposData (dexie path)", () => {
  it("exports all four entities from Dexie with correct stats + source", async () => {
    await db.containers.bulkPut([CONTAINER]);
    await db.items.bulkPut([
      {
        id: 1,
        containerId: 1,
        content: "Invoice",
        priority: "none",
        categoryPath: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    await db.categories.bulkPut([
      {
        id: 1,
        path: "finance",
        parentPath: null,
        name: "finance",
        displayName: "Finanzen",
        level: 0,
      },
    ]);
    await db.actions.bulkPut([
      {
        id: 1,
        itemId: 1,
        text: "review",
        status: "open",
        dueDate: null,
        createdAt: "",
        completedAt: null,
      },
    ]);

    const backup = await exportToposData();
    expect(backup.source).toBe("dexie");
    expect(backup.stats).toEqual({
      containers: 1,
      items: 1,
      categories: 1,
      actions: 1,
    });
    expect(backup.data.containers[0].externalId).toBe(9001);
    expect(backup.data.actions[0].text).toBe("review");
  });
});

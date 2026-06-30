import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {db} from "../db/schema";
import type {ActionRow, Container, Item} from "../types/topos";
import {
    getSearchIndex,
    indexRemove,
    indexUpsertItem,
    rebuildSearchIndex,
} from "./buildIndex";

const container: Container = {
    id: 1,
    externalId: 1001,
    type: "folder",
    owner: "self",
    label: "Citibank Ordner",
    description: "Bankunterlagen und Vertraege",
    location: "Regal Fahrschule",
    sizeGroup: null,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: "2026-01-01T00:00:00",
};

const item: Item = {
    id: 7,
    containerId: 1,
    content: "Kontoauszug Sparda",
    priority: "none",
    categoryPath: "finance/bank",
    notes: null,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: "2026-01-01T00:00:00",
};

const action: ActionRow = {
    id: 9,
    itemId: 7,
    text: "Vertrag kuendigen",
    status: "open",
    dueDate: null,
    createdAt: "2026-01-01T00:00:00",
    completedAt: null,
};

beforeEach(async () => {
    await Promise.all([db.containers.clear(), db.items.clear(), db.actions.clear()]);
    await rebuildSearchIndex(); // reset the singleton to an empty index
});

describe("rebuildSearchIndex", () => {
    it("indexes every container, item and action from the Dexie cache", async () => {
        await db.containers.bulkAdd([container]);
        await db.items.bulkAdd([item]);
        await db.actions.bulkAdd([action]);

        const mini = await rebuildSearchIndex();
        expect(mini.documentCount).toBe(3);
    });

    it("makes imported items searchable (integration)", async () => {
        await db.items.bulkAdd([item]);
        await rebuildSearchIndex();
        const hits = getSearchIndex().search("Kontoauszug");
        expect(hits.length).toBe(1);
        expect(hits[0].id).toBe("item:7");
    });
});

describe("incremental updates", () => {
    it("upsert adds a single document without a full rebuild", () => {
        expect(getSearchIndex().documentCount).toBe(0);
        indexUpsertItem(item);
        expect(getSearchIndex().documentCount).toBe(1);
        expect(getSearchIndex().search("Sparda").length).toBe(1);
    });

    it("upsert on an existing id replaces it (no duplicate)", () => {
        indexUpsertItem(item);
        indexUpsertItem({...item, content: "Kontoauszug Commerzbank"});
        expect(getSearchIndex().documentCount).toBe(1);
        expect(getSearchIndex().search("Commerzbank").length).toBe(1);
    });

    it("remove discards the document from results", () => {
        indexUpsertItem(item);
        indexRemove("item", 7);
        expect(getSearchIndex().search("Kontoauszug").length).toBe(0);
    });
});

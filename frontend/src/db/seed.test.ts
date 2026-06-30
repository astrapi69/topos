import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {db} from "./schema";
import {clearDemoData, seedDemoDataIfEmpty, _resetSeedGuard, DEMO_ID_FLOOR} from "./seed";
import type {Container} from "../types/topos";

const REAL_CONTAINER: Container = {
    id: 1,
    externalId: 1,
    type: "folder",
    owner: "self",
    label: "Real",
    description: null,
    location: null,
    sizeGroup: null,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: "2026-01-01T00:00:00",
};

beforeEach(async () => {
    _resetSeedGuard();
    await Promise.all([
        db.containers.clear(),
        db.items.clear(),
        db.categories.clear(),
        db.actions.clear(),
    ]);
});

describe("seedDemoDataIfEmpty", () => {
    it("seeds a demo set into an empty cache", async () => {
        const seeded = await seedDemoDataIfEmpty();
        expect(seeded).toBe(true);
        expect(await db.containers.count()).toBe(3);
        expect(await db.items.count()).toBeGreaterThanOrEqual(8);
        expect(await db.categories.count()).toBe(6);
        expect(await db.actions.count()).toBe(4);
    });

    it("marks demo rows with ids >= DEMO_ID_FLOOR", async () => {
        await seedDemoDataIfEmpty();
        const containers = await db.containers.toArray();
        expect(containers.every((c) => c.id >= DEMO_ID_FLOOR)).toBe(true);
    });

    it("does not seed when the cache already holds data", async () => {
        await db.containers.add(REAL_CONTAINER);
        _resetSeedGuard();
        const seeded = await seedDemoDataIfEmpty();
        expect(seeded).toBe(false);
        expect(await db.containers.count()).toBe(1);
    });

    it("is concurrency-safe (no double insert)", async () => {
        const [a, b] = await Promise.all([
            seedDemoDataIfEmpty(),
            seedDemoDataIfEmpty(),
        ]);
        expect([a, b]).toContain(true);
        expect(await db.containers.count()).toBe(3);
    });

    it("keeps item->container and action->item relations valid", async () => {
        await seedDemoDataIfEmpty();
        const containerIds = new Set((await db.containers.toArray()).map((c) => c.id));
        const itemIds = new Set((await db.items.toArray()).map((i) => i.id));
        for (const item of await db.items.toArray()) {
            expect(containerIds.has(item.containerId)).toBe(true);
        }
        for (const action of await db.actions.toArray()) {
            expect(itemIds.has(action.itemId)).toBe(true);
        }
    });
});

describe("clearDemoData", () => {
    it("removes demo rows but keeps real rows", async () => {
        await seedDemoDataIfEmpty();
        await db.containers.add(REAL_CONTAINER);
        await clearDemoData();
        const remaining = await db.containers.toArray();
        expect(remaining.map((c) => c.id)).toEqual([1]);
        expect(await db.items.count()).toBe(0);
    });
});

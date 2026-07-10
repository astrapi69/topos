import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {db, refreshTable} from "./schema";
import type {Container} from "../types/topos";

function container(id: number, label: string): Container {
    return {
        id,
        externalId: id,
        type: "box",
        owner: "self",
        label,
        description: null,
        location: null,
        sizeGroup: null,
        createdAt: "",
        updatedAt: "",
    };
}

beforeEach(async () => {
    await db.containers.clear();
});

describe("refreshTable", () => {
    it("replaces the cached rows with the fresh payload", async () => {
        await db.containers.bulkAdd([container(1, "Alt")]);
        await refreshTable(db.containers, [container(2, "Neu")]);
        const rows = await db.containers.toArray();
        expect(rows.map((row) => row.label)).toEqual(["Neu"]);
    });

    it("clears the table when the fresh payload is empty", async () => {
        await db.containers.bulkAdd([container(1, "Alt")]);
        await refreshTable(db.containers, []);
        expect(await db.containers.count()).toBe(0);
    });

    it("survives concurrent refreshes of the same table", async () => {
        // Regression pin: React StrictMode double-mounts effects, so two
        // refreshContainers() calls interleave. With a non-transactional
        // clear + bulkAdd this raced into a BulkError (duplicate primary
        // key), the hook caught it as an error and the page rendered an
        // empty list although both HTTP responses carried the data
        // (flaky photo-intake smoke, 2026-07-10).
        const rows = [container(1, "Kellerbox"), container(2, "Ordner")];
        await Promise.all([
            refreshTable(db.containers, rows),
            refreshTable(db.containers, rows),
            refreshTable(db.containers, rows),
        ]);
        const stored = await db.containers.toArray();
        expect(stored.map((row) => row.id).sort()).toEqual([1, 2]);
    });
});

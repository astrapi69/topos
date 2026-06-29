import "fake-indexeddb/auto";
import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import {db} from "../db/schema";
import type {ActionRow, Container, Item} from "../types/topos";
import {rebuildSearchIndex} from "./buildIndex";
import {useSearch} from "./useSearch";

const containers: Container[] = [
    {
        id: 1,
        externalId: 1001,
        type: "folder",
        owner: "self",
        label: "Citibank Ordner",
        description: "Bankunterlagen",
        location: "Regal",
        sizeGroup: null,
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00",
    },
];
const items: Item[] = [
    {
        id: 7,
        containerId: 1,
        content: "Kontoauszug Sparda",
        priority: "none",
        categoryPath: "finance/bank",
        notes: null,
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00",
    },
];
const actions: ActionRow[] = [
    {
        id: 9,
        itemId: 7,
        text: "Vertrag kuendigen",
        status: "open",
        dueDate: null,
        createdAt: "2026-01-01T00:00:00",
        completedAt: null,
    },
];

beforeEach(async () => {
    await Promise.all([db.containers.clear(), db.items.clear(), db.actions.clear()]);
    await db.containers.bulkAdd(containers);
    await db.items.bulkAdd(items);
    await db.actions.bulkAdd(actions);
    await rebuildSearchIndex();
});

describe("useSearch", () => {
    it("returns an empty list for an empty query", () => {
        const {result} = renderHook(() => useSearch(""));
        expect(result.current).toEqual([]);
    });

    it("returns an empty list when nothing matches", async () => {
        const {result} = renderHook(() => useSearch("zzzznomatch"));
        await new Promise((r) => setTimeout(r, 250));
        expect(result.current).toEqual([]);
    });

    it("finds a single item by content and exposes a displayTitle", async () => {
        const {result} = renderHook(() => useSearch("Kontoauszug"));
        await waitFor(() => expect(result.current.length).toBeGreaterThan(0));
        const hit = result.current.find((r) => r.type === "item");
        expect(hit).toBeDefined();
        expect(hit?.refId).toBe(7);
        expect(hit?.displayTitle).toContain("Kontoauszug");
        expect(hit?.containerId).toBe(1);
    });

    it("matches across types for a shared term (multiple results)", async () => {
        // "bank" appears in the container description and the item categoryPath.
        const {result} = renderHook(() => useSearch("bank"));
        await waitFor(() => expect(result.current.length).toBeGreaterThanOrEqual(2));
        const types = new Set(result.current.map((r) => r.type));
        expect(types.has("container")).toBe(true);
        expect(types.has("item")).toBe(true);
    });

    it("fuzzy-matches a misspelled query", async () => {
        // "Kontoausug" is missing a letter from "Kontoauszug".
        const {result} = renderHook(() => useSearch("Kontoausug"));
        await waitFor(() => expect(result.current.length).toBeGreaterThan(0));
        expect(result.current.some((r) => r.refId === 7 && r.type === "item")).toBe(true);
    });
});

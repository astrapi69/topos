/**
 * Demo seed data for the Dexie-only mode (e.g. the GitHub Pages PWA,
 * where there is no backend to populate the cache).
 *
 * Seeded rows use ids >= ``DEMO_ID_FLOOR`` so they are recognisable and
 * removable. They are also replaced automatically the first time a real
 * backend answers, because the data hooks clear each table before
 * writing the server payload (see ``refreshTable``). German texts on
 * purpose - German is the app's default language and the realistic use
 * case.
 */

import {db} from "./schema";
import type {ActionRow, Category, Container, Item} from "../types/topos";

/** Ids at or above this floor mark demo rows (vs. real backend rows,
 *  which the backend numbers from 1 upwards). */
export const DEMO_ID_FLOOR = 9000;

const TS = "2024-01-15T10:00:00";

const DEMO_CONTAINERS: Container[] = [
    {
        id: 9001,
        externalId: 1001,
        type: "folder",
        owner: "self",
        label: "Finanzen",
        description: null,
        location: "Regal Büro, oberes Fach",
        sizeGroup: null,
        createdAt: TS,
        updatedAt: TS,
    },
    {
        id: 9002,
        externalId: 1002,
        type: "folder",
        owner: "self",
        label: "Versicherungen",
        description: null,
        location: "Regal Büro, mittleres Fach",
        sizeGroup: null,
        createdAt: TS,
        updatedAt: TS,
    },
    {
        id: 9003,
        externalId: 3001,
        type: "box",
        owner: "self",
        label: "Archiv 2024",
        description: "Abgeschlossene Unterlagen aus 2024.",
        location: "Keller, Regal links",
        sizeGroup: "3000-3099",
        createdAt: TS,
        updatedAt: TS,
    },
];

const DEMO_ITEMS: Item[] = [
    {id: 9101, containerId: 9001, content: "Kontoauszüge Sparkasse 2024", priority: "medium", categoryPath: "finance/bank", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9102, containerId: 9001, content: "Depotübersicht Wertpapiere", priority: "low", categoryPath: "finance/bank", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9103, containerId: 9001, content: "Steuerunterlagen 2023", priority: "high", categoryPath: "finance", notes: "Fristen beachten.", createdAt: TS, updatedAt: TS},
    {id: 9104, containerId: 9002, content: "Hausratversicherung Police", priority: "medium", categoryPath: "finance/insurance", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9105, containerId: 9002, content: "Kfz-Versicherung", priority: "medium", categoryPath: "finance/insurance", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9106, containerId: 9002, content: "Haftpflichtversicherung", priority: "low", categoryPath: "finance/insurance", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9107, containerId: 9003, content: "Alte Verträge 2024", priority: "none", categoryPath: "archive/2024", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9108, containerId: 9003, content: "Garantiebelege Elektronik", priority: "low", categoryPath: "archive", notes: null, createdAt: TS, updatedAt: TS},
    {id: 9109, containerId: 9003, content: "Reisedokumente 2024", priority: "none", categoryPath: "archive/2024", notes: null, createdAt: TS, updatedAt: TS},
];

const DEMO_CATEGORIES: Category[] = [
    {id: 9201, path: "finance", parentPath: null, name: "finance", displayName: "Finanzen", level: 0},
    {id: 9202, path: "finance/bank", parentPath: "finance", name: "bank", displayName: "Bank", level: 1},
    {id: 9203, path: "finance/insurance", parentPath: "finance", name: "insurance", displayName: "Versicherung", level: 1},
    {id: 9204, path: "archive", parentPath: null, name: "archive", displayName: "Archiv", level: 0},
    {id: 9205, path: "archive/2024", parentPath: "archive", name: "2024", displayName: "2024", level: 1},
    {id: 9206, path: "documents", parentPath: null, name: "documents", displayName: "Dokumente", level: 0},
];

const DEMO_ACTIONS: ActionRow[] = [
    {id: 9301, itemId: 9103, text: "Steuererklärung 2023 einreichen", status: "open", dueDate: "2024-05-31", createdAt: TS, completedAt: null},
    {id: 9302, itemId: 9101, text: "Kontoauszüge sortieren und ablegen", status: "done", dueDate: null, createdAt: TS, completedAt: "2024-02-10T09:00:00"},
    {id: 9303, itemId: 9104, text: "Hausratversicherung auf Deckungssumme prüfen", status: "open", dueDate: null, createdAt: TS, completedAt: null},
    {id: 9304, itemId: 9107, text: "Alte Verträge datenschutzkonform entsorgen", status: "done", dueDate: null, createdAt: TS, completedAt: "2024-03-01T14:00:00"},
];

// Shared promise so a double-invocation (React StrictMode mounts effects
// twice) does not insert the demo set twice.
let seedPromise: Promise<boolean> | null = null;

async function insertDemoData(): Promise<boolean> {
    const total =
        (await db.containers.count()) +
        (await db.items.count()) +
        (await db.categories.count()) +
        (await db.actions.count());
    // Only seed a completely empty cache (first visit, no real data).
    if (total > 0) return false;
    await db.transaction("rw", db.containers, db.items, db.categories, db.actions, async () => {
        await db.containers.bulkAdd(DEMO_CONTAINERS);
        await db.items.bulkAdd(DEMO_ITEMS);
        await db.categories.bulkAdd(DEMO_CATEGORIES);
        await db.actions.bulkAdd(DEMO_ACTIONS);
    });
    return true;
}

/** Seed the demo set if the cache is empty. Idempotent + concurrency-safe.
 *  Returns true iff demo rows were inserted. */
export function seedDemoDataIfEmpty(): Promise<boolean> {
    if (seedPromise === null) {
        seedPromise = insertDemoData();
    }
    return seedPromise;
}

/** Remove the demo rows (ids >= DEMO_ID_FLOOR) from every table. Used
 *  when a real backend connects so demo data never mixes with real data. */
export async function clearDemoData(): Promise<void> {
    await db.transaction("rw", db.containers, db.items, db.categories, db.actions, async () => {
        await db.containers.where("id").aboveOrEqual(DEMO_ID_FLOOR).delete();
        await db.items.where("id").aboveOrEqual(DEMO_ID_FLOOR).delete();
        await db.categories.where("id").aboveOrEqual(DEMO_ID_FLOOR).delete();
        await db.actions.where("id").aboveOrEqual(DEMO_ID_FLOOR).delete();
    });
    seedPromise = null;
}

/** Test seam: drop the cached seed promise. */
export function _resetSeedGuard(): void {
    seedPromise = null;
}

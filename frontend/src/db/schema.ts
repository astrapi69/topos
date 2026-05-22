/**
 * IndexedDB schema for Topos.
 *
 * Dexie is used as a read-through cache: pages fetch from the API,
 * write the response into Dexie, then ``useLiveQuery`` provides
 * reactivity. The backend is the source of truth; the cache exists
 * so the UI can render instantly (stale-while-revalidate) and so the
 * dashboard stays usable in offline mode.
 *
 * Sync (Dexie -> backend) is deliberately out of scope. Mutations
 * still go through the API; the cache is updated from the response.
 */

import Dexie, {type Table} from "dexie";

import type {ActionRow, Category, Container, Item} from "../types/topos";

class ToposDB extends Dexie {
    containers!: Table<Container, number>;
    items!: Table<Item, number>;
    categories!: Table<Category, number>;
    actions!: Table<ActionRow, number>;

    constructor() {
        super("topos");
        this.version(1).stores({
            containers: "id, externalId, type, owner, location",
            items: "id, containerId, priority, categoryPath",
            categories: "id, &path, parentPath, level",
            actions: "id, itemId, status, dueDate",
        });
    }
}

export const db = new ToposDB();

/** Replace the cached collection for a table with a fresh server payload. */
export async function refreshTable<T, K>(
    table: Table<T, K>,
    rows: T[],
): Promise<void> {
    await table.clear();
    if (rows.length > 0) {
        await table.bulkAdd(rows);
    }
}

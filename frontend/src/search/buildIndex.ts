/**
 * Search-index store: a module-level MiniSearch singleton plus a tiny
 * subscribe/notify layer so React (via useSearch) re-runs queries when
 * the index changes.
 *
 * - rebuildSearchIndex(): full rebuild from the Dexie cache. Called once
 *   on app start and again after an Excel import.
 * - indexUpsert / indexRemove: incremental updates for individual CRUD so
 *   we never rebuild the whole index on a single create/update/delete.
 */

import type MiniSearch from "minisearch";

import {db} from "../db/schema";
import type {ActionRow, Container, Item} from "../types/topos";
import {
    actionToDoc,
    containerToDoc,
    createSearchIndex,
    docId,
    itemToDoc,
    type SearchDoc,
    type SearchType,
} from "./index";

let index: MiniSearch<SearchDoc> = createSearchIndex();
let version = 0;
const subscribers = new Set<() => void>();

function notify(): void {
    version += 1;
    for (const cb of subscribers) cb();
}

export function getSearchIndex(): MiniSearch<SearchDoc> {
    return index;
}

export function getSearchVersion(): number {
    return version;
}

export function subscribeSearch(callback: () => void): () => void {
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
    };
}

/** Full rebuild from the Dexie cache. Returns the new index. */
export async function rebuildSearchIndex(): Promise<MiniSearch<SearchDoc>> {
    const [containers, items, actions] = await Promise.all([
        db.containers.toArray(),
        db.items.toArray(),
        db.actions.toArray(),
    ]);
    const docs: SearchDoc[] = [
        ...containers.map(containerToDoc),
        ...items.map(itemToDoc),
        ...actions.map(actionToDoc),
    ];
    const fresh = createSearchIndex();
    fresh.addAll(docs);
    index = fresh;
    notify();
    return index;
}

function upsert(doc: SearchDoc): void {
    // replace() = discard + add; safe whether or not the id already exists.
    if (index.has(doc.id)) index.replace(doc);
    else index.add(doc);
    notify();
}

export function indexUpsertContainer(container: Container): void {
    upsert(containerToDoc(container));
}

export function indexUpsertItem(item: Item): void {
    upsert(itemToDoc(item));
}

export function indexUpsertAction(action: ActionRow): void {
    upsert(actionToDoc(action));
}

export function indexRemove(type: SearchType, refId: number): void {
    const id = docId(type, refId);
    if (index.has(id)) {
        index.discard(id);
        notify();
    }
}

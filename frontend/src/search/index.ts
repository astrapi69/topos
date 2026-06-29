/**
 * MiniSearch configuration + document model for Topos client-side search.
 *
 * Search runs entirely in the browser over the Dexie cache - no backend
 * endpoint. Containers, items and actions are flattened into a uniform
 * SearchDoc: a stable string `id` ("item:42"), the `type`, the numeric
 * `refId`, a concatenated `text` field (the only indexed field) plus
 * stored fields the UI needs to render and navigate a hit.
 *
 * Indexed source text per type:
 * - container: label + description + location
 * - item:      content + categoryPath + notes
 * - action:    text
 */

import MiniSearch from "minisearch";

import type {ActionRow, Container, Item} from "../types/topos";

export type SearchType = "item" | "container" | "action";

export interface SearchDoc {
    /** Stable composite id, e.g. "item:42". */
    id: string;
    type: SearchType;
    /** Numeric id within its table. */
    refId: number;
    /** Concatenated searchable text (the only indexed field). */
    text: string;
    /** Human-readable primary title for the hit. */
    title: string;
    /** Raw secondary text: categoryPath (item) / status (action) / location (container). */
    secondary: string;
    /** Owning container (items) for navigation + label lookup; null otherwise. */
    containerId: number | null;
    /** Owning item (actions) for subtitle + the actions view; null otherwise. */
    itemId: number | null;
}

/** Default MiniSearch search options: fuzzy + prefix as the spec requires. */
export const SEARCH_OPTIONS = {fuzzy: 0.2, prefix: true} as const;

/** Build an empty, configured MiniSearch instance. */
export function createSearchIndex(): MiniSearch<SearchDoc> {
    return new MiniSearch<SearchDoc>({
        fields: ["text"],
        storeFields: ["type", "refId", "title", "secondary", "containerId", "itemId"],
        searchOptions: {...SEARCH_OPTIONS},
    });
}

export function docId(type: SearchType, refId: number): string {
    return `${type}:${refId}`;
}

function joinText(parts: Array<string | null | undefined>): string {
    return parts.filter((p): p is string => Boolean(p && p.trim())).join(" ");
}

export function containerToDoc(c: Container): SearchDoc {
    return {
        id: docId("container", c.id),
        type: "container",
        refId: c.id,
        text: joinText([c.label, c.description, c.location]),
        title: c.label,
        secondary: c.location ?? "",
        containerId: c.id,
        itemId: null,
    };
}

export function itemToDoc(i: Item): SearchDoc {
    return {
        id: docId("item", i.id),
        type: "item",
        refId: i.id,
        text: joinText([i.content, i.categoryPath, i.notes]),
        title: i.content,
        secondary: i.categoryPath ?? "",
        containerId: i.containerId,
        itemId: i.id,
    };
}

export function actionToDoc(a: ActionRow): SearchDoc {
    return {
        id: docId("action", a.id),
        type: "action",
        refId: a.id,
        text: a.text,
        title: a.text,
        secondary: a.status,
        containerId: null,
        itemId: a.itemId,
    };
}

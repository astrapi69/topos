/**
 * useSearch: debounced (200ms) client-side full-text search over the
 * MiniSearch index. Re-runs automatically when the index changes (via the
 * store subscription). An empty query returns an empty list.
 */

import {useEffect, useMemo, useState, useSyncExternalStore} from "react";

import {getSearchIndex, getSearchVersion, subscribeSearch} from "./buildIndex";
import {SEARCH_OPTIONS, type SearchType} from "./index";

export interface SearchResult {
    id: string;
    type: SearchType;
    refId: number;
    score: number;
    /** Query terms that matched (e.g. fuzzy-expanded). */
    match: string[];
    /** Human-readable primary title. */
    displayTitle: string;
    /** Raw secondary text (categoryPath / status / location). */
    secondary: string;
    containerId: number | null;
    itemId: number | null;
}

export function useSearch(query: string, limit = 20): SearchResult[] {
    const version = useSyncExternalStore(subscribeSearch, getSearchVersion, getSearchVersion);
    const [debounced, setDebounced] = useState(query);

    useEffect(() => {
        const handle = setTimeout(() => setDebounced(query), 200);
        return () => clearTimeout(handle);
    }, [query]);

    return useMemo(() => {
        const q = debounced.trim();
        if (!q) return [];
        const results = getSearchIndex().search(q, {...SEARCH_OPTIONS});
        return results.slice(0, limit).map((r) => ({
            id: String(r.id),
            type: r.type as SearchType,
            refId: r.refId as number,
            score: r.score,
            match: Object.keys((r.match ?? {}) as Record<string, unknown>),
            displayTitle: (r.title as string) ?? "",
            secondary: (r.secondary as string) ?? "",
            containerId: (r.containerId as number | null) ?? null,
            itemId: (r.itemId as number | null) ?? null,
        }));
        // `version` is a dependency so results refresh when the index changes.
    }, [debounced, version, limit]);
}

/**
 * Stale-while-revalidate data hooks for Topos entities.
 *
 * Pattern per entity:
 *
 * 1. On mount, the hook reads the cached rows from Dexie and renders
 *    them immediately (empty array on first visit; cached payload
 *    afterwards).
 * 2. A second effect kicks off the API fetch in the background and
 *    writes the result back into Dexie + state. The UI swaps the
 *    stale rows for fresh ones once the request settles.
 *
 * The frontend does not depend on ``dexie-react-hooks``; reactivity
 * comes from the explicit ``refresh()`` callback the hooks return.
 * Mutations call ``api.<entity>.xxx`` then ``refresh()``.
 */

import {useCallback, useEffect, useState} from "react";

import {api} from "../api/client";
import {db, refreshTable} from "../db/schema";
import type {ActionRow, ActionStatus, Category, Container, Item} from "../types/topos";

interface CachedResult<T> {
    data: T[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

interface CachedSingle<T> {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

export async function refreshContainers(): Promise<Container[]> {
    const fresh = await api.containers.list();
    await refreshTable(db.containers, fresh);
    return fresh;
}

export async function refreshItems(): Promise<Item[]> {
    const fresh = await api.items.list();
    await refreshTable(db.items, fresh);
    return fresh;
}

export async function refreshCategories(): Promise<Category[]> {
    const fresh = await api.categories.list();
    await refreshTable(db.categories, fresh);
    return fresh;
}

export async function refreshActions(): Promise<ActionRow[]> {
    const fresh = await api.actions.list();
    await refreshTable(db.actions, fresh);
    return fresh;
}

/** Refresh every cached table in one shot. Called after a successful
 *  Excel import so the dashboard reflects the new state immediately. */
export async function refreshAll(): Promise<void> {
    await Promise.all([
        refreshContainers(),
        refreshItems(),
        refreshCategories(),
        refreshActions(),
    ]);
}

function useCachedCollection<T extends {id: number}>(
    loadCached: () => Promise<T[]>,
    fetchFresh: () => Promise<T[]>,
): CachedResult<T> {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fresh = await fetchFresh();
            setData(fresh);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [fetchFresh]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const cached = await loadCached();
                if (!cancelled && cached.length > 0) {
                    setData(cached);
                }
            } catch {
                // Cache misses are fine; the fresh fetch below populates state.
            }
            try {
                const fresh = await fetchFresh();
                if (!cancelled) {
                    setData(fresh);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) setError(e as Error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadCached, fetchFresh]);

    return {data, loading, error, refresh};
}

export function useContainers(): CachedResult<Container> {
    const loadCached = useCallback(() => db.containers.toArray(), []);
    return useCachedCollection<Container>(loadCached, refreshContainers);
}

export function useItems(filters: {containerId?: number} = {}): CachedResult<Item> {
    const {containerId} = filters;
    const loadCached = useCallback(
        () =>
            containerId !== undefined
                ? db.items.where("containerId").equals(containerId).toArray()
                : db.items.toArray(),
        [containerId],
    );
    const fetchFresh = useCallback(async () => {
        if (containerId !== undefined) {
            const fresh = await api.items.list({containerId});
            // Replace just this container's slice in the cache.
            await db.items.where("containerId").equals(containerId).delete();
            if (fresh.length > 0) await db.items.bulkPut(fresh);
            return fresh;
        }
        return refreshItems();
    }, [containerId]);
    return useCachedCollection<Item>(loadCached, fetchFresh);
}

export function useCategories(): CachedResult<Category> {
    const loadCached = useCallback(() => db.categories.toArray(), []);
    return useCachedCollection<Category>(loadCached, refreshCategories);
}

export function useActions(filters: {status?: ActionStatus} = {}): CachedResult<ActionRow> {
    const {status} = filters;
    const loadCached = useCallback(
        () =>
            status !== undefined
                ? db.actions.where("status").equals(status).toArray()
                : db.actions.toArray(),
        [status],
    );
    const fetchFresh = useCallback(async () => {
        if (status !== undefined) {
            const fresh = await api.actions.list({status});
            await db.actions.where("status").equals(status).delete();
            if (fresh.length > 0) await db.actions.bulkPut(fresh);
            return fresh;
        }
        return refreshActions();
    }, [status]);
    return useCachedCollection<ActionRow>(loadCached, fetchFresh);
}

export function useContainer(id: number | null): CachedSingle<Container> {
    const [data, setData] = useState<Container | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (id === null) {
            setData(undefined);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fresh = await api.containers.get(id);
            await db.containers.put(fresh);
            setData(fresh);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (id === null) {
                setLoading(false);
                return;
            }
            const cached = await db.containers.get(id);
            if (!cancelled && cached) setData(cached);
            try {
                const fresh = await api.containers.get(id);
                if (!cancelled) {
                    setData(fresh);
                    await db.containers.put(fresh);
                }
            } catch (e) {
                if (!cancelled) setError(e as Error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return {data, loading, error, refresh};
}

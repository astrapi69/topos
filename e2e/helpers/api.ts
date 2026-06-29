/**
 * Direct API helpers for e2e test setup / teardown.
 * Bypasses the UI for fast data manipulation.
 */

const API = "http://localhost:8010/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        headers: {"Content-Type": "application/json"},
        ...options,
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`API ${path}: ${res.status} ${await res.text()}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

/** Wipe every Topos table via direct DELETE calls. The bootstrap
 *  does not ship a /test/reset endpoint, so we list containers (and
 *  let cascade delete handle items + actions) plus categories. */
export async function resetDb(): Promise<void> {
    const containers = await request<Array<{id: number}>>("/containers");
    for (const c of containers) {
        await request(`/containers/${c.id}`, {method: "DELETE"});
    }
    const categories = await request<Array<{id: number}>>("/categories");
    for (const cat of categories) {
        await request(`/categories/${cat.id}`, {method: "DELETE"});
    }
}

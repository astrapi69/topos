/**
 * Build a nested category forest from flat category rows.
 *
 * Mirrors the backend ``build_tree`` in
 * ``backend/app/services/categories.py`` so the Dexie-only mode (e.g.
 * the GitHub Pages PWA, where ``GET /api/categories/tree`` is not
 * reachable) can materialise the same ``CategoryNode`` graph from the
 * flat rows already cached in Dexie.
 *
 * @example
 * const flat = [
 *   {id: 1, path: "finance", parentPath: null, name: "finance", displayName: "Finanzen", level: 0},
 *   {id: 2, path: "finance/bank", parentPath: "finance", name: "bank", displayName: "Bank", level: 1},
 * ];
 * const forest = buildCategoryTree(flat);
 * // forest[0].children[0].path === "finance/bank"
 */

import type {Category, CategoryNode} from "../types/topos";

/**
 * Materialise a forest of ``CategoryNode`` from flat ``Category`` rows.
 *
 * O(N) over the rows: build the per-path node map in one pass, then link
 * each node into its parent's ``children`` list. Rows whose
 * ``parentPath`` is ``null`` (or points at a path not present in the
 * input) become forest roots. Rows are sorted by ``path`` first so the
 * output order matches the backend endpoint.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
    const rows = [...categories].sort((a, b) => a.path.localeCompare(b.path));
    const byPath = new Map<string, CategoryNode>();
    for (const row of rows) {
        byPath.set(row.path, {
            path: row.path,
            name: row.name,
            displayName: row.displayName,
            level: row.level,
            children: [],
        });
    }
    const roots: CategoryNode[] = [];
    for (const row of rows) {
        const node = byPath.get(row.path)!;
        const parent = row.parentPath !== null ? byPath.get(row.parentPath) : undefined;
        if (parent === undefined) {
            roots.push(node);
        } else {
            parent.children.push(node);
        }
    }
    return roots;
}

/**
 * Build the hierarchical category tree from the flat category rows cached in
 * Dexie. Mirrors the shape returned by ``GET /api/categories/tree`` so the
 * CategoryBrowse page can render from the local cache in offline (no-backend)
 * mode instead of calling the API.
 */

import type {Category, CategoryNode} from "../types/topos";

/**
 * Assemble ``CategoryNode[]`` roots from flat ``Category`` rows. A row whose
 * ``parentPath`` is null (or points to a category absent from the input) is a
 * root. Children are ordered by path for a stable render.
 */
export function buildCategoryTree(flat: Category[]): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>();
    for (const category of flat) {
        nodes.set(category.path, {
            path: category.path,
            name: category.name,
            displayName: category.displayName,
            level: category.level,
            children: [],
        });
    }

    const roots: CategoryNode[] = [];
    const sorted = [...flat].sort((a, b) => a.path.localeCompare(b.path));
    for (const category of sorted) {
        const node = nodes.get(category.path);
        if (!node) continue;
        const parent = category.parentPath ? nodes.get(category.parentPath) : undefined;
        if (parent) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

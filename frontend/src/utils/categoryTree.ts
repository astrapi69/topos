/**
 * Build the hierarchical category tree from the flat category rows cached in
 * Dexie. Mirrors the shape returned by ``GET /api/categories/tree`` so the
 * CategoryBrowse page can render from the local cache in offline (no-backend)
 * mode instead of calling the API.
 *
 * The linking itself is `@astrapi69/tree-kit`; this module owns only the two
 * things that are Topos-specific - the orphan tolerance below, and the mapping
 * onto ``CategoryNode``, which is an API response type and therefore cannot be
 * replaced by the kit's own node shape.
 */

import { buildTreeFromFlat, type TreeNode } from "@astrapi69/tree-kit";

import type { Category, CategoryNode } from "../types/topos";

/**
 * Detach rows whose ``parentPath`` names a category that is not in the input.
 *
 * Categories can legitimately outlive their parent: deleting a parent orphans
 * its children (the app has an orphan report and a reassign flow for exactly
 * this). tree-kit rejects unknown parent references by design, so the dangling
 * link is cut here and the row becomes a root - the behaviour this module had
 * before the kit, pinned by the "orphan-safe" test.
 */
function detachDanglingParents(flat: Category[]): Category[] {
  const known = new Set(flat.map((category) => category.path));
  return flat.map((category) =>
    category.parentPath && !known.has(category.parentPath)
      ? { ...category, parentPath: null }
      : category,
  );
}

/** Project the kit's node onto the API's ``CategoryNode`` shape. */
function toCategoryNode(node: TreeNode<Category, string>): CategoryNode {
  return {
    path: node.value.path,
    name: node.value.name,
    displayName: node.value.displayName,
    level: node.value.level,
    children: node.children.map(toCategoryNode),
  };
}

/**
 * Assemble ``CategoryNode[]`` roots from flat ``Category`` rows. A row whose
 * ``parentPath`` is null (or points to a category absent from the input) is a
 * root. Children are ordered by path for a stable render.
 */
export function buildCategoryTree(flat: Category[]): CategoryNode[] {
  const forest = buildTreeFromFlat(detachDanglingParents(flat), {
    getId: (category) => category.path,
    getParentId: (category) => category.parentPath,
    sort: (a, b) => a.path.localeCompare(b.path),
  });

  return forest.map(toCategoryNode);
}

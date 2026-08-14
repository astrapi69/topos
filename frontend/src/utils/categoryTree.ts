/**
 * Build the hierarchical category tree from the flat category rows cached in
 * Dexie. Mirrors the shape returned by ``GET /api/categories/tree`` so the
 * CategoryBrowse page can render from the local cache in offline (no-backend)
 * mode instead of calling the API.
 *
 * The linking is `@astrapi69/tree-kit` in its tolerant mode (a category
 * can outlive its parent); this module owns only the mapping onto
 * ``CategoryNode``, which is an API response type and therefore cannot be
 * replaced by the kit's own node shape.
 */

import { buildTreeFromFlat, type TreeNode } from "@astrapi69/tree-kit";

import type { Category, CategoryNode } from "../types/topos";

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
  // promoteToRoot instead of a hand-rolled sanitizer: categories can
  // legitimately outlive their parent (the app has an orphan report and
  // a reassign flow), and the orphan-safe pin holds either way.
  const forest = buildTreeFromFlat(flat, {
    getId: (category) => category.path,
    getParentId: (category) => category.parentPath,
    sort: (a, b) => a.path.localeCompare(b.path),
    onInvalidParent: "promoteToRoot",
  });

  return forest.map(toCategoryNode);
}

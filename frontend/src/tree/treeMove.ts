/**
 * Move rules and execution for the inventory tree.
 *
 * The tree is a projection of flat rows, so a "move" never mutates tree
 * nodes. An item move updates its containerId (the storage service
 * re-numbers it in the target, keeping the `42-3` semantics). A
 * container move updates its parentContainerId (physical nesting: a
 * folder stands in a shelf, a box in a cabinet) or, on a group drop,
 * its (type, owner) pair. After the write the caller refreshes and the
 * tree rebuilds itself.
 *
 * `canDrop` is the single source of truth for what may move where; the
 * drag gesture and the "Verschieben nach..." menu both consult it, so
 * the two surfaces cannot disagree. The cycle check needs no parent
 * walk here: `source` is a node of the CURRENT tree, so "target is a
 * descendant of source" is a subtree containment question.
 *
 * @example
 * if (canDrop(source, target)) await applyMove(source, target, getStorage());
 */

import type { IStorageService } from "../storage/types";
import type { InventoryNode } from "./inventoryTree";

/** Depth-first: does `node`'s subtree contain the node with `id`? */
function subtreeContains(node: InventoryNode, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some((child) => subtreeContains(child, id));
}

/**
 * Whether `source` may be dropped onto `target`.
 *
 * - item -> another container: yes (its own container is a no-op, not a
 *   move, and must not light up as a drop target).
 * - container -> container: yes - nesting - unless the target is the
 *   container itself, one of its descendants (that would close a
 *   cycle), or its current parent (no-op).
 * - container -> group: yes when it changes anything - a different
 *   (type, owner) pair, or the container is nested and the drop pulls
 *   it back to the group's top level.
 * - container -> root: yes when nested - detach only.
 * - items outside a container: never.
 */
export function canDrop(source: InventoryNode, target: InventoryNode): boolean {
  if (source.kind === "item" && target.kind === "container") {
    return (
      source.item !== undefined &&
      target.container !== undefined &&
      source.item.containerId !== target.container.id
    );
  }
  if (source.kind !== "container" || source.container === undefined) {
    return false;
  }
  const nested = source.container.parentContainerId != null;
  if (target.kind === "container" && target.container !== undefined) {
    return (
      source.container.id !== target.container.id &&
      source.container.parentContainerId !== target.container.id &&
      !subtreeContains(source, target.id)
    );
  }
  if (target.kind === "group" && target.group !== undefined) {
    return (
      nested ||
      source.container.type !== target.group.type ||
      source.container.owner !== target.group.owner
    );
  }
  if (target.kind === "root") {
    return nested;
  }
  return false;
}

/**
 * Execute a legal move through the storage seam. Throws on an illegal
 * pair instead of writing - callers gate the UI with {@link canDrop},
 * so reaching the throw means a wiring bug, not a user mistake.
 */
export async function applyMove(
  source: InventoryNode,
  target: InventoryNode,
  storage: IStorageService,
): Promise<void> {
  if (!canDrop(source, target)) {
    throw new Error(
      `illegal move: ${source.kind} (${source.id}) onto ${target.kind} (${target.id})`,
    );
  }
  if (source.kind === "item" && source.item && target.container) {
    await storage.items.update(source.item.id, {
      containerId: target.container.id,
    });
    return;
  }
  if (source.kind !== "container" || !source.container) return;

  if (target.kind === "container" && target.container) {
    await storage.containers.update(source.container.id, {
      parentContainerId: target.container.id,
    });
  } else if (target.kind === "group" && target.group) {
    await storage.containers.update(source.container.id, {
      type: target.group.type,
      owner: target.group.owner,
      parentContainerId: null,
    });
  } else if (target.kind === "root") {
    await storage.containers.update(source.container.id, {
      parentContainerId: null,
    });
  }
}

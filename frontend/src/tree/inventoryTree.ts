/**
 * The inventory as one forest: group -> container -> item.
 *
 * This is the shape the Excel workbook has always had. Its three sheets are
 * (type, owner) pairs, not arbitrary tabs - "Meine Ordner" is folder/self,
 * "Ordner Eltern" is folder/parents, "Boxen" is box/self (see the excel-import
 * plugin's parser). The list view flattens that into a table; this module
 * keeps it.
 *
 * Groups are DERIVED from the rows, never hardcoded to those three pairs. The
 * model allows combinations the workbook has no sheet for - a shared folder, a
 * box belonging to the parents - and a view that claims to show everything
 * must not drop them. The same property is what makes user-defined container
 * types land here for free if they ever arrive: a new type simply produces a
 * new group.
 *
 * Linking is `@astrapi69/tree-kit`; what this module owns is the synthetic
 * group level, the per-subtree item counts, and the ordering.
 *
 * @example
 * ```ts
 * const forest = buildInventoryTree(containers, items)
 * for (const group of forest) {
 *   console.log(group.label, group.itemCount)
 * }
 * ```
 */

import { buildTreeFromFlat, type TreeNode } from "@astrapi69/tree-kit";

import {
  CONTAINER_TYPES,
  type Container,
  type ContainerType,
  type Item,
  type Owner,
} from "../types/topos";

/** What a node stands for. The four levels are never mixed up by accident. */
export type InventoryNodeKind = "root" | "group" | "container" | "item";

export interface InventoryNode {
  /** Unique within the tree: `root`, `group:folder:self`, `container:3`, `item:10`. */
  id: string;
  kind: InventoryNodeKind;
  /** Rendered text. Groups carry their label, containers and items theirs. */
  label: string;
  /** The user-facing number: `42` for a container, `42-3` for an item. */
  number: string | null;
  /** Items in this subtree, inclusive of descendants; 1 on an item leaf. */
  itemCount: number;
  /** The row this node came from, so a click can route to it. */
  container?: Container;
  item?: Item;
  /** On group nodes: the (type, owner) pair the group stands for. */
  group?: { type: ContainerType; owner: Owner };
  children: InventoryNode[];
}

/**
 * Labels for the derived groups, resolved by the caller through i18n. The
 * owner side is a template with a `{type}` slot because German puts the
 * possessive on either side: "Meine Ordner" but "Ordner Eltern" - a plain
 * "type + owner" concatenation cannot produce both.
 */
export interface GroupLabels {
  /** Plural type names: "Ordner", "Boxen". */
  type: Record<ContainerType, string>;
  /** Per-owner template with a `{type}` placeholder. */
  template: Record<Owner, string>;
}

const DEFAULT_GROUP_LABELS: GroupLabels = {
  type: {
    folder: "Ordner",
    box: "Boxen",
    drawer: "Schubladen",
    shelf: "Regale",
    case: "Koffer",
    safe: "Tresore",
  },
  template: {
    self: "Meine {type}",
    parents: "{type} Eltern",
    shared: "{type} geteilt",
  },
};

/** The single synthetic root: the app itself. */
export const ROOT_ID = "root";

/** Stable id for the group a container belongs to. */
export function groupKeyOf(type: ContainerType, owner: Owner): string {
  return `group:${type}:${owner}`;
}

/**
 * One flat row per node, so tree-kit can link all three levels in one pass.
 * The group rows are synthetic: they have no database counterpart.
 */
interface FlatRow {
  id: string;
  parentId: string | null;
  kind: InventoryNodeKind;
  label: string;
  number: string | null;
  sortKey: number;
  container?: Container;
  item?: Item;
  group?: { type: ContainerType; owner: Owner };
}

function groupLabel(
  type: ContainerType,
  owner: Owner,
  labels: GroupLabels,
): string {
  return labels.template[owner].replace("{type}", labels.type[type]);
}

function rootRow(): FlatRow {
  // The app name is a proper noun, identical across locales - not i18n.
  return {
    id: ROOT_ID,
    parentId: null,
    kind: "root",
    label: "Topos",
    number: null,
    sortKey: 0,
  };
}

function groupRows(containers: Container[], labels: GroupLabels): FlatRow[] {
  const seen = new Map<string, FlatRow>();
  for (const container of containers) {
    const id = groupKeyOf(container.type, container.owner);
    if (seen.has(id)) continue;
    seen.set(id, {
      id,
      parentId: ROOT_ID,
      kind: "group",
      label: groupLabel(container.type, container.owner, labels),
      number: null,
      group: { type: container.type, owner: container.owner },
      // Curated-enum order (folders first, like the workbook), own
      // before other people's within a type. Every type gets a distinct
      // band so two groups never tie on the sort key.
      sortKey:
        CONTAINER_TYPES.indexOf(container.type) * 100 +
        (container.owner === "self"
          ? 0
          : container.owner === "parents"
            ? 1
            : 2),
    });
  }
  return [...seen.values()];
}

/**
 * Resolve each container's effective tree parent: its parent container
 * when that is visible and the chain is sound, else its (type, owner)
 * group. Two degradations, both deliberate:
 *
 * - The page filters the container list, so a visible child of an
 *   invisible parent falls back to its group instead of vanishing.
 * - A cycle in the data (should never happen - every write path guards)
 *   would make tree-kit throw; the members fall back to their group so
 *   the view renders corrupted data instead of crashing on it.
 */
function effectiveParents(containers: Container[]): Map<number, number | null> {
  const byId = new Map(
    containers.map((container) => [container.id, container]),
  );
  const resolved = new Map<number, number | null>();
  for (const container of containers) {
    let parentId: number | null = container.parentContainerId ?? null;
    if (parentId !== null && !byId.has(parentId)) parentId = null;
    if (parentId !== null) {
      const seen = new Set<number>([container.id]);
      let current: number | null = parentId;
      while (current !== null) {
        if (seen.has(current)) {
          parentId = null; // cycle: degrade to the group
          break;
        }
        seen.add(current);
        const next: number | null | undefined =
          byId.get(current)?.parentContainerId;
        current = next != null && byId.has(next) ? next : null;
      }
    }
    resolved.set(container.id, parentId);
  }
  return resolved;
}

function containerRows(
  containers: Container[],
  parents: Map<number, number | null>,
): FlatRow[] {
  return containers.map((container) => {
    const parentId = parents.get(container.id) ?? null;
    return {
      id: `container:${container.id}`,
      parentId:
        parentId !== null
          ? `container:${parentId}`
          : groupKeyOf(container.type, container.owner),
      kind: "container" as const,
      label: container.label,
      number: String(container.externalId),
      sortKey: container.externalId,
      container,
    };
  });
}

function itemRows(
  items: Item[],
  visibleContainers: Map<number, Container>,
): FlatRow[] {
  return (
    items
      // The caller may pass a filtered container list; an item pointing outside
      // it is not an error, it is simply not visible here.
      .filter((item) => visibleContainers.has(item.containerId))
      .map((item) => {
        const parent = visibleContainers.get(item.containerId);
        return {
          id: `item:${item.id}`,
          parentId: `container:${item.containerId}`,
          kind: "item" as const,
          label: item.content,
          number:
            parent && item.externalId !== null
              ? `${parent.externalId}-${item.externalId}`
              : null,
          sortKey: item.externalId ?? Number.MAX_SAFE_INTEGER,
          item,
        };
      })
  );
}

/** Depth-first projection that also accumulates the per-subtree item counts. */
function toInventoryNode(node: TreeNode<FlatRow, string>): InventoryNode {
  const children = node.children.map(toInventoryNode);
  const own = node.value.kind === "item" ? 1 : 0;
  return {
    id: node.value.id,
    kind: node.value.kind,
    label: node.value.label,
    number: node.value.number,
    itemCount:
      own + children.reduce((total, child) => total + child.itemCount, 0),
    container: node.value.container,
    item: node.value.item,
    group: node.value.group,
    children,
  };
}

/**
 * Build the tree from the flat container and item rows. The single root is
 * the app itself; groups, containers and items hang off it, so the whole
 * inventory is one tree, mirroring the workbook (one file, three sheets).
 *
 * @param containers - containers to show; may already be filtered by the page.
 * @param items - all items; those outside `containers` are dropped.
 * @param labels - group labels, normally resolved through i18n by the caller.
 */
export function buildInventoryTree(
  containers: Container[],
  items: Item[],
  labels: GroupLabels = DEFAULT_GROUP_LABELS,
): InventoryNode {
  const byId = new Map(
    containers.map((container) => [container.id, container]),
  );
  const parents = effectiveParents(containers);
  // Groups exist for the containers that hang off one: a folder nested
  // inside a shelf lives under the shelf, not under a folder group.
  const topLevel = containers.filter(
    (container) => parents.get(container.id) === null,
  );
  const rows = [
    rootRow(),
    ...groupRows(topLevel, labels),
    ...containerRows(containers, parents),
    ...itemRows(items, byId),
  ];

  const forest = buildTreeFromFlat(rows, {
    getId: (row) => row.id,
    getParentId: (row) => row.parentId,
    sort: (a, b) => a.sortKey - b.sortKey,
  });

  return toInventoryNode(forest[0]);
}

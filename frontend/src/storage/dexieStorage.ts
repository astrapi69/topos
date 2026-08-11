/**
 * dexie-mode storage: a real offline-first store backed by IndexedDB.
 *
 * No backend, no demo data, no read-through cache - create/update/delete all
 * persist to Dexie and survive a reload. Ids are assigned locally (max + 1 per
 * table) since there is no server to hand them out; the GitHub Pages build is
 * a dexie-only deployment, so these never collide with server ids.
 *
 * Cascade + category semantics mirror the backend
 * (`backend/app/services/*`): deleting a container removes its items and their
 * actions; deleting an item removes its actions; renaming a category rewrites
 * the subtree and the item `categoryPath`s; deleting a category orphans its
 * items (path -> null) and drops the subtree.
 */

import type { Table } from "dexie";

import { db } from "../db/schema";
import { buildCategoryTree } from "../utils/categoryTree";
import type {
  ActionCreate,
  ActionUpdate,
  BulkItemCreate,
  BulkItemsResult,
  CategoryCreate,
  CategoryDeleteResult,
  CategoryRenameResult,
  ContainerCreate,
  ContainerUpdate,
  ItemCreate,
  ItemUpdate,
  OrphanReport,
} from "../api/client";
import type { ActionRow, Category, Container, Item } from "../types/topos";
import type { IStorageService } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Next local id for a table: max existing id + 1 (1 for an empty table). */
async function nextId<T extends { id: number }>(
  table: Table<T, number>,
): Promise<number> {
  const rows = await table.toArray();
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function notFound(kind: string, id: number): never {
  throw new Error(`${kind} ${id} not found`);
}

// --- containers ---

async function createContainer(payload: ContainerCreate): Promise<Container> {
  return db.transaction("rw", db.containers, async () => {
    const id = await nextId(db.containers);
    const ts = nowIso();
    const container: Container = {
      id,
      externalId: payload.externalId,
      type: payload.type,
      owner: payload.owner,
      label: payload.label,
      description: payload.description ?? null,
      location: payload.location ?? null,
      sizeGroup: payload.sizeGroup ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.containers.put(container);
    return container;
  });
}

async function deleteContainer(id: number): Promise<void> {
  await db.transaction("rw", db.containers, db.items, db.actions, async () => {
    const items = await db.items.where("containerId").equals(id).toArray();
    const itemIds = items.map((item) => item.id);
    if (itemIds.length > 0) {
      await db.actions.where("itemId").anyOf(itemIds).delete();
      await db.items.where("containerId").equals(id).delete();
    }
    await db.containers.delete(id);
  });
}

// --- items ---

/**
 * Next free per-container item number ("highest + 1").
 *
 * Deliberately not "count + 1": deleting an item must not hand its
 * number to a later one, or two entries in the same folder would end up
 * carrying the same label on paper. Mirrors the backend service.
 */
async function nextItemExternalId(containerId: number): Promise<number> {
  const siblings = await db.items
    .where("containerId")
    .equals(containerId)
    .toArray();
  const highest = siblings.reduce(
    (max, row) => Math.max(max, row.externalId ?? 0),
    0,
  );
  return highest + 1;
}

/**
 * Number any row that has none yet, in creation order. Rows written by
 * a build from before the field existed carry null; numbering them on
 * read means no item stays unnumbered without a migration step.
 */
async function backfillItemExternalIds(items: Item[]): Promise<Item[]> {
  const missing = items.filter((row) => row.externalId == null);
  if (missing.length === 0) return items;
  const next = new Map<number, number>();
  for (const item of [...missing].sort((a, b) => a.id - b.id)) {
    let number = next.get(item.containerId);
    if (number === undefined)
      number = await nextItemExternalId(item.containerId);
    item.externalId = number;
    next.set(item.containerId, number + 1);
    await db.items.put(item);
  }
  return items;
}

async function createItem(payload: ItemCreate): Promise<Item> {
  return db.transaction("rw", db.items, async () => {
    const id = await nextId(db.items);
    const ts = nowIso();
    const item: Item = {
      id,
      containerId: payload.containerId,
      // An import supplies the number the entry already had; anything
      // else gets the next free one in the container.
      externalId:
        payload.externalId ?? (await nextItemExternalId(payload.containerId)),
      content: payload.content,
      priority: payload.priority ?? "none",
      categoryPath: payload.categoryPath ?? null,
      notes: payload.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.items.put(item);
    return item;
  });
}

/**
 * Update an item; moving it to another container re-numbers it there.
 * The number is per container, so carrying the old one across would
 * duplicate a label that already exists in the target.
 */
async function updateItem(id: number, payload: ItemUpdate): Promise<Item> {
  const existing = (await db.items.get(id)) ?? notFound("Item", id);
  const patch = { ...payload } as Partial<Item>;
  if (
    payload.containerId !== undefined &&
    payload.containerId !== existing.containerId
  ) {
    patch.externalId = await nextItemExternalId(payload.containerId);
  }
  return updateRow<Item>(db.items, id, patch, "Item");
}

async function deleteItem(id: number): Promise<void> {
  await db.transaction("rw", db.items, db.actions, async () => {
    await db.actions.where("itemId").equals(id).delete();
    await db.items.delete(id);
  });
}

async function bulkCreateItems(
  rows: BulkItemCreate[],
): Promise<BulkItemsResult> {
  return db.transaction("rw", db.items, async () => {
    let id = await nextId(db.items);
    const ts = nowIso();
    // Number within the batch without a query per row: the first row for
    // a container reads the current highest, the rest count on.
    const nextNumbers = new Map<number, number>();
    for (const row of rows) {
      if (!nextNumbers.has(row.containerId)) {
        nextNumbers.set(
          row.containerId,
          await nextItemExternalId(row.containerId),
        );
      }
    }
    const created: Item[] = rows.map((row) => ({
      id: id++,
      containerId: row.containerId,
      externalId: (() => {
        const number = nextNumbers.get(row.containerId) as number;
        nextNumbers.set(row.containerId, number + 1);
        return number;
      })(),
      content: row.content,
      priority: row.priority ?? "none",
      categoryPath: row.categoryPath ?? null,
      notes: row.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
    }));
    await db.items.bulkPut(created);
    return { created, errors: [] };
  });
}

// --- categories ---

function categoryLevel(path: string): number {
  return path.split("/").length - 1;
}

async function renameCategory(
  id: number,
  newPath: string,
): Promise<CategoryRenameResult> {
  return db.transaction("rw", db.categories, db.items, async () => {
    const category = await db.categories.get(id);
    if (!category) notFound("Category", id);
    const oldPath = category.path;
    if (newPath === oldPath) {
      return {
        renamed: false,
        itemsUpdated: 0,
        subcategoriesUpdated: 0,
        category,
      };
    }
    const segments = newPath.split("/");

    // Subcategories under the old prefix.
    const children = await db.categories
      .filter((row) => row.path.startsWith(`${oldPath}/`))
      .toArray();
    for (const child of children) {
      const rewritten = newPath + child.path.slice(oldPath.length);
      const parent =
        child.parentPath && child.parentPath.startsWith(oldPath)
          ? newPath + child.parentPath.slice(oldPath.length)
          : child.parentPath;
      await db.categories.put({
        ...child,
        path: rewritten,
        parentPath: parent,
        level: categoryLevel(rewritten),
      });
    }

    await db.categories.put({
      ...category,
      path: newPath,
      parentPath: segments.slice(0, -1).join("/") || null,
      name: segments[segments.length - 1],
      level: segments.length - 1,
    });

    // Items pointing at the old path or its subtree.
    const items = await db.items
      .filter(
        (item) =>
          item.categoryPath === oldPath ||
          (item.categoryPath?.startsWith(`${oldPath}/`) ?? false),
      )
      .toArray();
    for (const item of items) {
      const path = item.categoryPath as string;
      const rewritten = newPath + path.slice(oldPath.length);
      await db.items.put({ ...item, categoryPath: rewritten });
    }

    const fresh = (await db.categories.get(id)) as Category;
    return {
      renamed: true,
      itemsUpdated: items.length,
      subcategoriesUpdated: children.length,
      category: fresh,
    };
  });
}

async function deleteCategory(id: number): Promise<CategoryDeleteResult> {
  return db.transaction("rw", db.categories, db.items, async () => {
    const category = await db.categories.get(id);
    if (!category) notFound("Category", id);
    const oldPath = category.path;

    const orphaned = await db.items
      .filter(
        (item) =>
          item.categoryPath === oldPath ||
          (item.categoryPath?.startsWith(`${oldPath}/`) ?? false),
      )
      .toArray();
    for (const item of orphaned) {
      await db.items.put({ ...item, categoryPath: null });
    }

    const children = await db.categories
      .filter((row) => row.path.startsWith(`${oldPath}/`))
      .toArray();
    await db.categories.bulkDelete(children.map((child) => child.id));
    await db.categories.delete(id);

    return {
      deleted: true,
      itemsOrphaned: orphaned.length,
      subcategoriesDeleted: children.length,
    };
  });
}

async function listOrphans(): Promise<OrphanReport> {
  const [categories, items] = await Promise.all([
    db.categories.toArray(),
    db.items.toArray(),
  ]);
  const knownPaths = new Set(categories.map((category) => category.path));
  const orphanedItems = items
    .filter((item) => item.categoryPath && !knownPaths.has(item.categoryPath))
    .map((item) => ({
      id: item.id,
      content: item.content,
      categoryPath: item.categoryPath as string,
      containerId: item.containerId,
    }));
  return { orphanedItems, count: orphanedItems.length };
}

// --- actions ---

async function createAction(payload: ActionCreate): Promise<ActionRow> {
  return db.transaction("rw", db.actions, async () => {
    const id = await nextId(db.actions);
    const action: ActionRow = {
      id,
      itemId: payload.itemId,
      text: payload.text,
      status: payload.status ?? "open",
      dueDate: payload.dueDate ?? null,
      createdAt: nowIso(),
      // Normally null; an import restoring a completed action supplies it.
      completedAt: payload.completedAt ?? null,
    };
    await db.actions.put(action);
    return action;
  });
}

async function setActionStatus(
  id: number,
  status: ActionRow["status"],
  completedAt: string | null,
): Promise<ActionRow> {
  return db.transaction("rw", db.actions, async () => {
    const action = await db.actions.get(id);
    if (!action) notFound("Action", id);
    const updated: ActionRow = { ...action, status, completedAt };
    await db.actions.put(updated);
    return updated;
  });
}

async function updateRow<T extends { id: number; updatedAt?: string }>(
  table: Table<T, number>,
  id: number,
  patch: Partial<T>,
  kind: string,
): Promise<T> {
  return db.transaction("rw", table, async () => {
    const existing = await table.get(id);
    if (!existing) notFound(kind, id);
    const merged = { ...existing, ...patch } as T;
    if ("updatedAt" in merged) merged.updatedAt = nowIso();
    await table.put(merged);
    return merged;
  });
}

export const dexieStorage: IStorageService = {
  mode: "dexie",
  containers: {
    list: async (filters = {}) => {
      let rows = await db.containers.toArray();
      if (filters.owner)
        rows = rows.filter((row) => row.owner === filters.owner);
      if (filters.type) rows = rows.filter((row) => row.type === filters.type);
      return rows;
    },
    get: async (id) =>
      (await db.containers.get(id)) ?? notFound("Container", id),
    create: createContainer,
    update: (id, payload) =>
      updateRow<Container>(
        db.containers,
        id,
        payload as Partial<Container>,
        "Container",
      ),
    delete: deleteContainer,
  },
  items: {
    list: async (filters = {}) =>
      backfillItemExternalIds(
        filters.containerId !== undefined
          ? await db.items
              .where("containerId")
              .equals(filters.containerId)
              .toArray()
          : await db.items.toArray(),
      ),
    get: async (id) => (await db.items.get(id)) ?? notFound("Item", id),
    create: createItem,
    update: updateItem,
    delete: deleteItem,
    bulkCreate: bulkCreateItems,
  },
  categories: {
    list: () => db.categories.toArray(),
    tree: async () => buildCategoryTree(await db.categories.toArray()),
    create: async (payload: CategoryCreate) =>
      db.transaction("rw", db.categories, async () => {
        const id = await nextId(db.categories);
        const category: Category = {
          id,
          path: payload.path,
          parentPath: payload.parentPath ?? null,
          name: payload.name,
          displayName: payload.displayName,
          level: payload.level ?? categoryLevel(payload.path),
        };
        await db.categories.put(category);
        return category;
      }),
    rename: renameCategory,
    delete: deleteCategory,
    orphans: listOrphans,
  },
  actions: {
    list: async (filters = {}) =>
      filters.status !== undefined
        ? db.actions.where("status").equals(filters.status).toArray()
        : db.actions.toArray(),
    get: async (id) => (await db.actions.get(id)) ?? notFound("Action", id),
    create: createAction,
    update: (id, payload: ActionUpdate) =>
      updateRow<ActionRow>(
        db.actions,
        id,
        payload as Partial<ActionRow>,
        "Action",
      ),
    delete: async (id) => {
      await db.actions.delete(id);
    },
    complete: (id) => setActionStatus(id, "done", nowIso()),
    reopen: (id) => setActionStatus(id, "open", null),
  },
};

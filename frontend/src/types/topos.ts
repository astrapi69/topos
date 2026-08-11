/**
 * Topos domain types.
 *
 * Mirrors ``backend/app/schemas/*`` but uses camelCase at the client
 * boundary (snake_case is normalised inside ``api/client.ts``).
 */

export type ContainerType = "folder" | "box";
export type Owner = "self" | "parents" | "shared";
export type Priority = "none" | "low" | "medium" | "high" | "very_high";
export type ActionStatus = "open" | "done" | "archived";

export interface Container {
  id: number;
  externalId: number;
  type: ContainerType;
  owner: Owner;
  label: string;
  description: string | null;
  location: string | null;
  sizeGroup: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: number;
  containerId: number;
  /**
   * User-facing number, counted per container: item 3 in folder 42 is
   * shown as "42-3". Assigned automatically (highest + 1), re-assigned
   * when the item moves. Null only for rows written before the field
   * existed; both storage backends backfill those on read.
   */
  externalId: number | null;
  content: string;
  priority: Priority;
  categoryPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  path: string;
  parentPath: string | null;
  name: string;
  displayName: string;
  level: number;
}

export interface CategoryNode {
  path: string;
  name: string;
  displayName: string;
  level: number;
  children: CategoryNode[];
}

/** A container photo as returned by the backend (paths relative to /api). */
export interface ContainerPhotoRead {
  id: number;
  containerId: number;
  mime: string;
  createdAt: string;
  fullUrl: string;
  thumbUrl: string;
}

/** A photo blob stored in Dexie (offline/PWA mode). */
export interface PhotoRow {
  id?: number;
  containerId: number;
  blob: Blob;
  thumbBlob: Blob;
  mime: string;
  createdAt: string;
}

export interface ActionRow {
  id: number;
  itemId: number;
  text: string;
  status: ActionStatus;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ImportReport {
  containersCreated: number;
  containersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsPruned: number;
  actionsCreated: number;
  categoriesCreated: number;
  warnings: string[];
}

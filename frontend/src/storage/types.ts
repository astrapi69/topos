/**
 * Storage-service seam (mirrors adaptive-learner's `IStorageService`).
 *
 * Pages/components must call `getStorage()` and use this interface instead of
 * the raw `api.*` client, so the SAME code works in two deployments:
 *
 *  - **api** mode: a backend is the source of truth; every call is an HTTP
 *    request (the existing `api.*` client).
 *  - **dexie** mode: no backend (the GitHub Pages PWA). Every call reads/writes
 *    IndexedDB directly, so the app is a real offline-first store - create,
 *    edit, delete all persist locally, no demo data, no "connect a backend".
 *
 * The two implementations are interchangeable; the factory in `index.ts` picks
 * one at first use (build flag + user preference + auto).
 */

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
import type {
  ActionRow,
  ActionStatus,
  Category,
  CategoryNode,
  Container,
  ContainerType,
  Item,
  Owner,
} from "../types/topos";

export type StorageMode = "api" | "dexie";

export interface ContainerStore {
  list(filters?: { owner?: Owner; type?: ContainerType }): Promise<Container[]>;
  get(id: number): Promise<Container>;
  create(payload: ContainerCreate): Promise<Container>;
  update(id: number, payload: ContainerUpdate): Promise<Container>;
  delete(id: number): Promise<void>;
}

export interface ItemStore {
  list(filters?: { containerId?: number }): Promise<Item[]>;
  get(id: number): Promise<Item>;
  create(payload: ItemCreate): Promise<Item>;
  update(id: number, payload: ItemUpdate): Promise<Item>;
  delete(id: number): Promise<void>;
  bulkCreate(items: BulkItemCreate[]): Promise<BulkItemsResult>;
}

export interface CategoryStore {
  list(): Promise<Category[]>;
  tree(): Promise<CategoryNode[]>;
  create(payload: CategoryCreate): Promise<Category>;
  rename(id: number, path: string): Promise<CategoryRenameResult>;
  delete(id: number): Promise<CategoryDeleteResult>;
  orphans(): Promise<OrphanReport>;
}

export interface ActionStore {
  list(filters?: { status?: ActionStatus }): Promise<ActionRow[]>;
  get(id: number): Promise<ActionRow>;
  create(payload: ActionCreate): Promise<ActionRow>;
  update(id: number, payload: ActionUpdate): Promise<ActionRow>;
  delete(id: number): Promise<void>;
  complete(id: number): Promise<ActionRow>;
  reopen(id: number): Promise<ActionRow>;
}

export interface IStorageService {
  readonly mode: StorageMode;
  containers: ContainerStore;
  items: ItemStore;
  categories: CategoryStore;
  actions: ActionStore;
}

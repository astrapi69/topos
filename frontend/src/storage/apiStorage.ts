/**
 * api-mode storage: every call is an HTTP request through the existing
 * `api.*` client. A thin adapter so the backend deployment keeps its current
 * behaviour while pages talk to the storage seam instead of `api` directly.
 */

import { api } from "../api/client";
import type { IStorageService } from "./types";

export const apiStorage: IStorageService = {
  mode: "api",
  containers: {
    list: (filters = {}) => api.containers.list(filters),
    get: (id) => api.containers.get(id),
    create: (payload) => api.containers.create(payload),
    update: (id, payload) => api.containers.update(id, payload),
    delete: (id) => api.containers.delete(id),
  },
  items: {
    list: (filters = {}) => api.items.list(filters),
    get: (id) => api.items.get(id),
    create: (payload) => api.items.create(payload),
    update: (id, payload) => api.items.update(id, payload),
    delete: (id) => api.items.delete(id),
    bulkCreate: (items) => api.items.bulkCreate(items),
  },
  categories: {
    list: () => api.categories.list(),
    tree: () => api.categories.tree(),
    create: (payload) => api.categories.create(payload),
    rename: (id, path) => api.categories.rename(id, path),
    delete: (id) => api.categories.delete(id),
    orphans: () => api.categories.orphans(),
  },
  actions: {
    list: (filters = {}) => api.actions.list(filters),
    get: (id) => api.actions.get(id),
    create: (payload) => api.actions.create(payload),
    update: (id, payload) => api.actions.update(id, payload),
    delete: (id) => api.actions.delete(id),
    complete: (id) => api.actions.complete(id),
    reopen: (id) => api.actions.reopen(id),
  },
};

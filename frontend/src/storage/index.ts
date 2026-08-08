/**
 * Storage factory. Pages call `getStorage()` and use the returned
 * `IStorageService`; the concrete implementation is picked once, in this
 * precedence (mirrors adaptive-learner):
 *
 *   0. Build flag `VITE_STORAGE_MODE === "dexie"` — the GitHub Pages build is
 *      a hard dexie-only deployment with NO backend, so it wins over anything
 *      a stale preference might say (a persisted "api" could never be served
 *      there and would 404 every request).
 *   1. Persisted user preference (`topos.storage_mode`) — only when the build
 *      is not a fixed dexie build.
 *   2. Auto: `api` (the local-dev / backend default).
 *
 * The instance is cached for the page lifetime (a Dexie connection is
 * expensive to reopen).
 */

import { apiStorage } from "./apiStorage";
import { dexieStorage } from "./dexieStorage";
import type { IStorageService, StorageMode } from "./types";

export type { IStorageService, StorageMode } from "./types";

const STORAGE_MODE_KEY = "topos.storage_mode";

function readPersistedMode(): StorageMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_MODE_KEY);
    return raw === "api" || raw === "dexie" ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the user's storage-mode choice. A reload is required to apply it. */
export function setPersistedStorageMode(mode: StorageMode): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    /* localStorage unavailable — silent no-op */
  }
}

function resolveMode(): StorageMode {
  if (import.meta.env.VITE_STORAGE_MODE === "dexie") return "dexie";
  return readPersistedMode() ?? "api";
}

let cached: IStorageService | null = null;

/** The storage service for this deployment (cached after the first call). */
export function getStorage(): IStorageService {
  if (cached === null) {
    cached = resolveMode() === "dexie" ? dexieStorage : apiStorage;
  }
  return cached;
}

/** The active storage mode. */
export function getStorageMode(): StorageMode {
  return getStorage().mode;
}

/** TEST ONLY: drop the cached instance so the next call re-resolves. */
export function _resetStorageForTest(): void {
  cached = null;
}

/**
 * One-shot backend-availability probe (Dexie-only mode gate).
 *
 * On a normal deployment GET /api/health answers and the app runs in API
 * mode (backend as source of truth, Dexie as read-through cache). On
 * GitHub Pages there is no backend, so the probe fails and the app runs
 * Dexie-only: the data hooks read the local cache instead of calling
 * /api on every page (which would 404 repeatedly and spam the console).
 *
 * The probe runs once and the resolved promise is cached for the page
 * lifetime, so every caller shares a single /api/health request.
 */

import { apiBase, getBackendUrl } from "../api/baseUrl";

const PROBE_TIMEOUT_MS = 3000;

let probe: Promise<boolean> | null = null;

/**
 * True when this build cannot have a backend: the GitHub Pages bundle
 * ships ``VITE_STORAGE_MODE=dexie`` and is served from static hosting,
 * so /api/* is guaranteed to 404. Probing there only spams the console
 * on every load. A backend URL configured in Settings overrides this -
 * the user explicitly pointed the app at a reachable backend.
 *
 * Read from the build flag directly (not via ``storage/index``) to keep
 * this module free of the storage -> api-client import chain.
 */
function backendImpossible(): boolean {
  return (
    import.meta.env.VITE_STORAGE_MODE === "dexie" && getBackendUrl() === ""
  );
}

export function isBackendAvailable(): Promise<boolean> {
  if (probe === null) {
    if (backendImpossible()) {
      probe = Promise.resolve(false);
      return probe;
    }
    probe = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${apiBase()}/health`, {
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return probe;
}

/** Test seam: drop the cached probe so each test starts fresh. */
export function _resetBackendProbe(): void {
  probe = null;
}

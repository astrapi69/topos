/**
 * Configurable backend base URL.
 *
 * By default the app talks to a same-origin backend at ``/api`` (the
 * Vite dev proxy in development, the same host in a bundled deployment).
 * When the backend runs elsewhere (a VPS, a home server, ...) the user
 * sets its origin in Settings; it is stored in localStorage because it
 * configures the API layer that sits in front of Dexie, not app data.
 */

const STORAGE_KEY = "topos.backend_url";

/** The configured backend origin without a trailing slash, or "" when
 *  the app should use the same-origin ``/api`` path. */
export function getBackendUrl(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

/** Persist (or clear, when empty) the configured backend origin. */
export function setBackendUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, "");
  try {
    if (cleaned) {
      localStorage.setItem(STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* localStorage unavailable (private mode); ignore. */
  }
}

/** Base for ``/api`` requests: ``"{configured}/api"`` when a backend
 *  origin is configured, else same-origin ``"{app-base}api"``. ``origin``
 *  overrides the stored value (used by the "test connection" probe before
 *  saving).
 *
 *  The same-origin case respects the Vite base path (``import.meta.env
 *  .BASE_URL``), so a subpath deployment like GitHub Pages ``/topos/``
 *  targets ``/topos/api`` instead of the wrong root ``/api``. Matches how
 *  ``pwa/update-store`` already builds ``version.json``. At root
 *  (``make dev``, Docker) BASE_URL is ``/`` so this stays ``/api``. */
export function apiBase(origin?: string): string {
  const base = (origin ?? getBackendUrl()).trim().replace(/\/+$/, "");
  if (base) return `${base}/api`;
  const appBase = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${appBase}/api`;
}

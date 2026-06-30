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

const PROBE_TIMEOUT_MS = 3000;

let probe: Promise<boolean> | null = null;

export function isBackendAvailable(): Promise<boolean> {
    if (probe === null) {
        probe = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
            try {
                const res = await fetch("/api/health", {signal: controller.signal});
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

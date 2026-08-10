import { apiBase } from "../api/baseUrl";
import { isBackendAvailable } from "./backendStatus";

/**
 * Cross-check the build-time __APP_VERSION__ against the backend
 * /api/health response at app start.
 *
 * Frontend version is a Vite build-time literal from package.json;
 * backend __version__ is derived from backend/pyproject.toml. In dev
 * with hot-reload of one half but not the other, the two can diverge
 * silently. A console.warn at startup surfaces the mismatch without
 * blocking render or breaking the app.
 *
 * Fails open on any fetch / parse / network error. Offline boot or a
 * backend that hasn't finished starting is not a divergence signal.
 *
 * Skipped entirely when no backend can answer (the static PWA build):
 * a version cross-check has nothing to compare against there, and the
 * request would only 404. The URL goes through ``apiBase()`` so a
 * subpath deployment hits ``/topos/api/health``, not the host root.
 */
export async function verifyBackendVersion(): Promise<void> {
  if (!(await isBackendAvailable())) return;
  try {
    const res = await fetch(`${apiBase()}/health`);
    if (!res.ok) return;
    const body = (await res.json()) as { version?: unknown };
    const backendVersion =
      typeof body.version === "string" ? body.version : null;
    if (!backendVersion) return;
    if (backendVersion !== __APP_VERSION__) {
      console.warn(
        `[topos] frontend/backend version mismatch: frontend=${__APP_VERSION__} backend=${backendVersion}. ` +
          "Rebuild whichever half is stale (frontend: npm run build; backend: restart uvicorn).",
      );
    }
  } catch {
    /* fail open: offline boot, backend not ready, parse error */
  }
}

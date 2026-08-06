/**
 * pwa/update-store - Topos's single @astrapi69/pwa-update store instance.
 *
 * The update mechanism lives in the package; this module is the thin app
 * binding. It reads the Vite build literals (see vite.config.ts `define`),
 * resolves the deployed manifest URL (base-aware, so it works under the
 * GitHub Pages "/topos/" subpath), and creates the store once.
 *
 * Replaces the old vite-plugin-pwa `useRegisterSW` path in PwaPrompts: that
 * only knew "a worker is waiting", never "the deployed build is newer than
 * the loaded one", so a GitHub Pages deploy left the service worker serving
 * stale views with no reliable prompt. The version.json manifest closes that
 * gap.
 */

import { createUpdateStore, type VersionManifest } from "@astrapi69/pwa-update";

/** The build this tab is running (build-time literals from vite.config.ts). */
export const CURRENT_BUILD: VersionManifest = {
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
  buildHash: typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "unknown",
};

/** Absolute URL of the deployed version.json (respects the Vite base path). */
export function versionJsonUrl(): string {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";
  return `${base}version.json`;
}

/**
 * The app-wide update store. A module singleton by design: the update state
 * is a single global fact about this tab, shared by the banner and any future
 * "check for updates" control so the two can never disagree. The
 * `storageNamespace` prefixes the package's localStorage keys.
 */
export const appUpdateStore = createUpdateStore({
  build: CURRENT_BUILD,
  manifestUrl: versionJsonUrl(),
  storageNamespace: "topos",
});

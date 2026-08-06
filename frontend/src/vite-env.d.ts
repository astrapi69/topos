/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Build-time literal injected by Vite (see frontend/vite.config.ts
// `define`). Single source of truth: frontend/package.json.
declare const __APP_VERSION__: string;

// Build-time literal: short git SHA of the built commit (see
// vite.config.ts `define`). Read by pwa/update-store.ts.
declare const __BUILD_HASH__: string;

// Build-time literal: committer date (ISO) of the built commit (see
// vite.config.ts `define`). Shown in the About section's VersionCard.
declare const __BUILD_DATE__: string;

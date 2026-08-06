/// <reference types="vitest" />
import {execSync} from "node:child_process";
import {copyFileSync, existsSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

import {defineConfig, type Plugin} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

import pkg from "./package.json" with {type: "json"};

// Build hash for @astrapi69/pwa-update's version manifest. The short git
// SHA of the built commit; "unknown" outside a git checkout (e.g. a
// tarball build). Paired with pkg.version so a deploy is detectable even
// when the version string itself did not change.
function resolveBuildHash(): string {
    try {
        return execSync("git rev-parse --short HEAD", {stdio: ["ignore", "pipe", "ignore"]})
            .toString()
            .trim();
    } catch {
        return "unknown";
    }
}
const buildHash = resolveBuildHash();

// Build date: committer date (ISO 8601) of the built commit, so it is
// deterministic to the commit rather than to when the build ran.
// "unknown" outside a git checkout; the About section's VersionCard omits
// the row when this is falsy and prints "unknown" verbatim otherwise.
function resolveBuildDate(): string {
    try {
        return execSync("git log -1 --format=%cI", {stdio: ["ignore", "pipe", "ignore"]})
            .toString()
            .trim();
    } catch {
        return "unknown";
    }
}
const buildDate = resolveBuildDate();

// Emit the deployed version manifest that @astrapi69/pwa-update fetches to
// detect a newer build. Served at "<base>version.json". In dev a tiny
// middleware serves it so the update store's fetch does not 404; at build
// it is written into dist/ alongside index.html.
function versionManifest(): Plugin {
    const body = JSON.stringify({version: pkg.version, buildHash});
    return {
        name: "topos-version-manifest",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url && req.url.replace(/\?.*$/, "").endsWith("/version.json")) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(body);
                    return;
                }
                next();
            });
        },
        closeBundle() {
            writeFileSync(resolve(process.cwd(), "dist", "version.json"), body);
        },
    };
}

// GitHub Pages has no SPA rewrite: a deep link like /topos/containers/5
// would 404. Serving a copy of index.html as 404.html makes GH Pages
// return the app shell for any unknown path, and React Router then
// resolves the route client-side.
function spa404Fallback(): Plugin {
    return {
        name: "spa-404-fallback",
        apply: "build",
        closeBundle() {
            const index = resolve(process.cwd(), "dist", "index.html");
            if (existsSync(index)) {
                copyFileSync(index, resolve(process.cwd(), "dist", "404.html"));
            }
        },
    };
}

// GitHub Pages serves the PWA under https://astrapi69.github.io/topos/,
// so the production GH-Pages build needs a "/topos/" base path while
// `make dev` and every other build stay at root. Driven by the
// GITHUB_PAGES env var the deploy workflow sets.
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const base = isGitHubPages ? "/topos/" : "/";

export default defineConfig({
    base,
    define: {
        // Single source of truth: package.json. Replaced at build
        // time (and during vitest runs) by the literal string.
        // Downstream code reads __APP_VERSION__ instead of
        // re-declaring a hardcoded constant.
        __APP_VERSION__: JSON.stringify(pkg.version),
        // Short git SHA of the built commit; read by pwa/update-store.ts to
        // build the running-build manifest for @astrapi69/pwa-update.
        __BUILD_HASH__: JSON.stringify(buildHash),
        // Committer date (ISO) of the built commit; shown in the About
        // section's VersionCard.
        __BUILD_DATE__: JSON.stringify(buildDate),
    },
    plugins: [
        react(),
        spa404Fallback(),
        versionManifest(),
        VitePWA({
            // "autoUpdate": a new service worker skips waiting, activates, and
            // the injected registration reloads the page - no confirmation
            // banner. Chosen for the solo rapid-deploy workflow: every
            // develop push redeploys GitHub Pages, and the old "prompt" model
            // left stale precached assets on the client until the user
            // accepted an update. autoUpdate makes stale-deploy self-heal.
            // (The @astrapi69/pwa-update UpdateBanner stays mounted but is now
            // effectively dormant - the auto-reload wins before it matters;
            // version.json is still emitted for its detection path.)
            registerType: "autoUpdate",
            devOptions: {
                enabled: true,
            },
            includeAssets: [
                "favicon.ico",
                "favicon.svg",
                "icons/apple-touch-icon.png",
                // Precache the static offline fallback so it is reachable at
                // <base>offline.html even when the network and the SW nav
                // fallback are both unavailable.
                "offline.html",
            ],
            manifest: {
                name: "Topos - Inventar-Tracker",
                short_name: "Topos",
                description: "Personal inventory tracker for folders, boxes, and what's inside them.",
                theme_color: "#1e40af", // tailwind blue-800
                background_color: "#111827", // tailwind gray-900
                display: "standalone",
                orientation: "portrait",
                scope: base,
                start_url: base,
                icons: [
                    {src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png"},
                    {src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png"},
                    {
                        src: "icons/maskable-icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
                categories: ["utilities", "productivity"],
                lang: "de",
                dir: "ltr",
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                // Evict precache entries from superseded builds so an old
                // deploy's chunks do not accumulate in the cache storage.
                cleanupOutdatedCaches: true,
                navigateFallback: `${base}index.html`,
                // /api is the backend, not an SPA route: never answer an API
                // request with the app shell (it would mask a real network
                // error as a 200 HTML page).
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        // NetworkFirst so the app keeps the last API responses
                        // available offline (relative path matches the dev
                        // proxy and the production same-origin /api).
                        urlPattern: ({url}) => url.pathname.startsWith("/api/"),
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "api-cache",
                            expiration: {maxEntries: 100, maxAgeSeconds: 60 * 60 * 24},
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                ],
            },
        }),
    ],
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
    },
    build: {
        // Vite 8 (Rolldown) accepts only the function form of
        // ``manualChunks``; the legacy object form Vite 7 supported
        // is no longer valid. Match each id against the packages-to-
        // chunk map and return the bucket name so Rolldown emits the
        // same chunk shape Rollup did under Vite 7.
        rollupOptions: {
            output: {
                manualChunks: (id: string) => {
                    if (!id.includes('node_modules')) return undefined;
                    const chunkMap: Record<string, string[]> = {
                        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                        'vendor-tiptap': [
                            '@tiptap/react',
                            '@tiptap/starter-kit',
                            '@tiptap/extension-image',
                            '@tiptap/extension-link',
                            '@tiptap/extension-table',
                            '@tiptap/extension-table-row',
                            '@tiptap/extension-table-cell',
                            '@tiptap/extension-table-header',
                            '@tiptap/extension-task-list',
                            '@tiptap/extension-task-item',
                            '@tiptap/extension-text-align',
                            '@tiptap/extension-text-style',
                            '@tiptap/extension-underline',
                            '@tiptap/extension-subscript',
                            '@tiptap/extension-superscript',
                            '@tiptap/extension-highlight',
                            '@tiptap/extension-color',
                            '@tiptap/extension-typography',
                            '@tiptap/extension-character-count',
                            '@tiptap/extension-placeholder',
                            '@tiptap/extension-code-block-lowlight',
                            '@pentestpad/tiptap-extension-figure',
                            '@sereneinserenade/tiptap-search-and-replace',
                            'tiptap-footnotes',
                        ],
                        'vendor-ui': [
                            '@radix-ui/react-context-menu',
                            '@radix-ui/react-dialog',
                            '@radix-ui/react-dropdown-menu',
                            '@radix-ui/react-select',
                            '@radix-ui/react-tabs',
                            '@radix-ui/react-toggle',
                            '@radix-ui/react-tooltip',
                            '@dnd-kit/core',
                            '@dnd-kit/sortable',
                            '@dnd-kit/utilities',
                            'lucide-react',
                            'react-toastify',
                        ],
                    };
                    for (const [chunkName, pkgs] of Object.entries(chunkMap)) {
                        for (const pkg of pkgs) {
                            // Trailing slash prevents react matching react-dom etc.
                            if (id.includes(`/node_modules/${pkg}/`)) {
                                return chunkName;
                            }
                        }
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 5183,
        open: true,
        proxy: {
            "/api": {
                // Default targets the backend on the host (the
                // `make dev` flow). Inside Docker Compose,
                // ``localhost`` resolves to the frontend container
                // itself, not the backend service - so override
                // via VITE_API_PROXY_TARGET=http://backend:8010 in
                // docker-compose.yml. The env var is read by Node
                // when vite.config.ts is evaluated; no client-side
                // exposure (so the VITE_ prefix is incidental, not
                // required).
                target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8010",
                changeOrigin: true,
            },
        },
    },
});

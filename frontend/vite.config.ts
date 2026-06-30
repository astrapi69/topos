/// <reference types="vitest" />
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

import pkg from "./package.json" with {type: "json"};

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
    },
    plugins: [
        react(),
        VitePWA({
            // "prompt" (not autoUpdate) so a new service worker WAITS and we
            // can show a "new version available" toast with an update button
            // (see usePwaUpdate). autoUpdate would silently reload instead.
            registerType: "prompt",
            devOptions: {
                enabled: true,
            },
            includeAssets: ["favicon.ico", "favicon.svg", "icons/apple-touch-icon.png"],
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
                navigateFallback: `${base}index.html`,
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

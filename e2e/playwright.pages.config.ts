import {defineConfig} from "@playwright/test";

/**
 * Specs that need the GitHub-Pages build (base /topos/, Dexie mode,
 * service worker, prerendered routes) rather than the dev server. Run
 * with:
 *   npx playwright test -c playwright.pages.config.ts
 *
 * Kept out of playwright.config.ts so the default suites do not pay for
 * a production build on every run.
 */
export default defineConfig({
    testDir: "./pages",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    use: {
        baseURL: "http://127.0.0.1:4174/topos/",
        actionTimeout: 10_000,
        trace: "on-first-retry",
        browserName: "chromium",
    },
    webServer: {
        command:
            "cd ../frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build && node ../e2e/tools/serve-pages.mjs",
        url: "http://127.0.0.1:4174/topos/",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});

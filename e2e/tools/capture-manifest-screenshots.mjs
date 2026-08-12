/**
 * Regenerates the manifest screenshots (frontend/public/screenshots/) from
 * the real GitHub-Pages build.
 *
 * The manifest names these images, and Android shows them in its install
 * dialog. An empty-state capture would tell an installer nothing, so the
 * script seeds a small inventory through the UI first - Dexie mode, so it
 * lands in IndexedDB exactly as a user's data would.
 *
 * Usage (from e2e/, so @playwright/test resolves):
 *
 *   cd frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build
 *   # serve dist under the /topos/ base, e.g.:
 *   #   mkdir -p /tmp/serve && ln -s "$PWD/dist" /tmp/serve/topos
 *   #   (cd /tmp/serve && python3 -m http.server 4174 --bind 127.0.0.1)
 *   cd ../e2e && SHOT_BASE=http://127.0.0.1:4174/topos/ \
 *     SHOT_OUT=../frontend/public/screenshots \
 *     node tools/capture-manifest-screenshots.mjs
 *
 * `vite preview` is deliberately not the server here: it answered
 * browser-initiated script requests with 404 while curl and in-page fetch
 * got 200 on the same URLs, so the app never booted. Any plain static
 * server works.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:4174/topos/";
const OUT = process.env.SHOT_OUT ?? ".";

const CONTAINERS = [
  { id: "42", label: "Versicherungen" },
  { id: "43", label: "Steuer 2025" },
  { id: "7", label: "Werkzeug" },
];

/** Items for the first container, so the detail view is not an empty state. */
const ITEMS = [
  "Hausratversicherung - Police + Nachträge",
  "Haftpflicht - Vertrag 2024",
  "Rechtsschutz - Kündigung zum 31.12.",
];

async function createContainers(page) {
  for (const container of CONTAINERS) {
    await page.goto(`${BASE}containers`, { waitUntil: "networkidle" });
    const newButton = page.getByTestId("container-new-button");
    if (await newButton.count()) await newButton.first().click();
    const idField = page.getByTestId("container-form-external-id");
    if (!(await idField.count())) return false;
    await idField.fill(container.id);
    await page.getByTestId("container-form-label").fill(container.label);
    await page.getByTestId("container-form-submit").click();
    await page.waitForTimeout(300);
  }
  return true;
}

async function createItems(page) {
  await page.goto(`${BASE}containers`, { waitUntil: "networkidle" });
  const firstRow = page.locator('[data-testid="container-table"] a').first();
  if (!(await firstRow.count())) return false;
  await firstRow.click();
  await page.waitForTimeout(400);

  for (const content of ITEMS) {
    await page.getByTestId("container-detail-new-item").click();
    // /items/new is its own lazily-loaded route: wait for the field to
    // mount instead of probing a count that is still 0 mid-navigation.
    const contentField = page.getByTestId("item-editor-content-input");
    await contentField.waitFor({ timeout: 10000 });
    await contentField.fill(content);
    await page.getByTestId("item-editor-submit").click();
    await page.waitForTimeout(400);
  }
  return true;
}

async function shoot(page, url, file, size) {
  await page.setViewportSize(size);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log("wrote", file, `${size.width}x${size.height}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

console.log("containers seeded:", await createContainers(page));
console.log("items seeded:", await createItems(page));
// Captured before navigating away: /containers/:id carries a local id.
const detailUrl = page.url();

// Wide: the container list, which is what the app is actually for.
await shoot(page, `${BASE}containers`, "desktop-containers.png", {
  width: 1280,
  height: 800,
});
// Narrow: one container with its contents, on a phone-sized viewport.
await shoot(page, detailUrl, "mobile-container-detail.png", {
  width: 400,
  height: 800,
});

await browser.close();

/**
 * Records every request the built GitHub-Pages artifact makes to a host
 * other than its own origin.
 *
 * The static scan (`frontend/src/artifact/externalHosts.ts`) proves what the
 * bundle *mentions*; this script proves what the running app *does*: it
 * drives first load, every static route, PhotoIntake without a key, the
 * Settings tabs, the update check and a reload with the service worker
 * active, listening at browser-context level so service-worker fetches
 * are counted too.
 *
 * Usage (from e2e/, so @playwright/test resolves):
 *
 *   cd frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build
 *   mkdir -p /tmp/serve && ln -sfn "$PWD/dist" /tmp/serve/topos
 *   (cd /tmp/serve && python3 -m http.server 4174 --bind 127.0.0.1 &)
 *   cd ../e2e && AUDIT_BASE=http://127.0.0.1:4174/topos/ \
 *     node tools/capture-external-requests.mjs
 *
 * Exit code 1 when any request left the origin, so the script doubles as
 * a runtime gate. Set AUDIT_JSON=<path> to also write the raw log.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:4174/topos/";
const ORIGIN = new URL(BASE).origin;
const ROUTES = [
  "",
  "containers",
  "items/new",
  "categories",
  "actions",
  "import",
  "photo-intake",
  "settings",
];

const requests = [];

function record(request, step) {
  const url = new URL(request.url());
  // A service-worker request has no frame; asking for one throws.
  const fromServiceWorker = Boolean(request.serviceWorker());
  requests.push({
    step,
    url: request.url(),
    origin: url.origin,
    type: request.resourceType(),
    method: request.method(),
    fromServiceWorker,
    initiator: fromServiceWorker ? "(service worker)" : request.frame().url(),
  });
}

async function settle(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  let step = "boot";
  context.on("request", (request) => record(request, step));

  const page = await context.newPage();

  for (const route of ROUTES) {
    step = `route:/${route}`;
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await settle(page);
  }

  // Settings: walk every tab so lazily mounted sections (AI, About) render.
  step = "settings:tabs";
  await page.goto(`${BASE}settings`, { waitUntil: "load" });
  await settle(page);
  const tabs = page.locator('[data-testid^="settings-tab"], [role="tab"]');
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i += 1) {
    await tabs.nth(i).click().catch(() => {});
    await settle(page, 800);
  }

  // Update check (About tab): the pwa-update kit fetches version.json.
  step = "settings:update-check";
  const updateWrap = page.getByTestId("about-update-check-wrap");
  if (await updateWrap.count()) {
    const button = updateWrap.locator("button").first();
    if (await button.count()) await button.click().catch(() => {});
    await settle(page);
  }

  // PhotoIntake without a stored key must not call any provider.
  step = "photo-intake:no-key";
  await page.goto(`${BASE}photo-intake`, { waitUntil: "load" });
  await settle(page);
  const recognize = page.getByTestId("photo-intake-recognize");
  if (await recognize.count()) await recognize.click().catch(() => {});
  await settle(page);

  // Reload with the service worker installed: navigations and assets now
  // come through workbox, whose requests only show at context level.
  step = "reload:sw-active";
  await page.goto(`${BASE}`, { waitUntil: "load" });
  await settle(page, 2500);
  await page.reload({ waitUntil: "load" });
  await settle(page, 2500);

  await browser.close();

  const external = requests.filter((entry) => entry.origin !== ORIGIN);
  const byOrigin = new Map();
  for (const entry of external) {
    const bucket = byOrigin.get(entry.origin) ?? { count: 0, steps: new Set(), types: new Set(), sample: entry.url };
    bucket.count += 1;
    bucket.steps.add(entry.step);
    bucket.types.add(entry.type);
    byOrigin.set(entry.origin, bucket);
  }

  console.log(`requests total: ${requests.length}, same-origin: ${requests.length - external.length}, external: ${external.length}`);
  console.log(`service-worker initiated: ${requests.filter((entry) => entry.fromServiceWorker).length}`);
  console.log("| origin | count | types | steps | sample |");
  console.log("|---|---|---|---|---|");
  for (const [origin, bucket] of byOrigin) {
    console.log(`| ${origin} | ${bucket.count} | ${[...bucket.types].join(", ")} | ${[...bucket.steps].join(", ")} | ${bucket.sample} |`);
  }
  if (byOrigin.size === 0) console.log("| (none) | 0 | | | |");

  if (process.env.AUDIT_JSON) {
    writeFileSync(process.env.AUDIT_JSON, JSON.stringify(requests, null, 2));
    console.log(`raw log: ${process.env.AUDIT_JSON}`);
  }
  process.exit(external.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});

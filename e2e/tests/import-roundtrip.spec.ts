/**
 * E2E roundtrip: Dashboard -> Import (upload fixture xlsx) ->
 * ContainerList shows rows -> click a container -> ContainerDetail
 * shows items.
 *
 * Covers the load-bearing user journey of the bootstrap. Per the
 * Phase 6 spec, one e2e is enough; future work can fan out to per-
 * feature smoke specs under e2e/smoke/.
 */

import path from "node:path";
import {expect, test} from "@playwright/test";

import {resetDb} from "../helpers/api";

// playwright.config testDir is ./tests, so the test file lives at
// e2e/tests/. The fixture sits one level up.
const FIXTURE = path.resolve(__dirname, "../fixtures/topos-seed.xlsx");

test.beforeEach(async () => {
    await resetDb();
});

test("import roundtrip: dashboard -> import -> list -> detail", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
    await expect(page.getByTestId("stat-containers")).toContainText("0");

    await page.getByTestId("nav-import").click();
    await expect(page.getByTestId("import-title")).toBeVisible();

    await page.getByTestId("import-file-input").setInputFiles(FIXTURE);
    await page.getByTestId("import-submit").click();

    await expect(page.getByTestId("import-report")).toBeVisible();
    await expect(page.getByTestId("report-containers-created")).toHaveText("2");
    await expect(page.getByTestId("report-items-created")).toHaveText("3");
    await expect(page.getByTestId("report-actions-created")).toHaveText("1");

    await page.getByTestId("nav-containers").click();
    await expect(page.getByTestId("container-list-title")).toBeVisible();
    await expect(page.getByTestId("container-table")).toBeVisible();
    // Two rows from the seed.
    await page.waitForSelector("[data-testid^='container-row-']");
    const rowCount = await page.locator("[data-testid^='container-row-']").count();
    expect(rowCount).toBe(2);

    // Click the first container link.
    const firstLink = page.locator("[data-testid^='container-link-']").first();
    const containerLabel = await firstLink.innerText();
    await firstLink.click();

    await expect(page.getByTestId("container-detail-title")).toContainText(containerLabel);
    await expect(page.getByTestId("container-detail-items")).toBeVisible();
});

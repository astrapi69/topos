/**
 * Smoke: mobile bottom tab bar vs. desktop top nav.
 *
 * Mobile (<md): the fixed bottom tab bar carries the four primary
 * destinations plus the "Mehr" sheet with the secondary ones; the
 * top bar shows only the wordmark. Desktop (md+): the tab bar is
 * hidden and the inline top-nav links take over.
 */

import {test, expect} from "@playwright/test";

const MOBILE = {width: 390, height: 844};
const DESKTOP = {width: 1280, height: 800};

test.describe("bottom tab bar (mobile)", () => {
    test.beforeEach(async ({page}) => {
        await page.setViewportSize(MOBILE);
        await page.goto("/");
    });

    test("shows the tab bar and navigates between primary tabs", async ({page}) => {
        await expect(page.getByTestId("topos-tabbar")).toBeVisible();
        await expect(page.getByTestId("nav-tab-dashboard")).toBeVisible();
        await expect(page.getByTestId("nav-tab-search")).toBeVisible();

        await page.getByTestId("nav-tab-containers").click();
        await expect(page.getByTestId("container-list-title")).toBeVisible();

        await page.getByTestId("nav-tab-photo-intake").click();
        await expect(page.getByTestId("photo-intake-title")).toBeVisible();

        await page.getByTestId("nav-tab-dashboard").click();
        await expect(page.getByTestId("dashboard-title")).toBeVisible();
    });

    test("opens the Mehr sheet and reaches a secondary destination", async ({page}) => {
        await expect(page.getByTestId("nav-more-menu")).toBeHidden();

        await page.getByTestId("nav-tab-more").click();
        await expect(page.getByTestId("nav-more-menu")).toBeVisible();

        await page.getByTestId("nav-settings-mobile").click();
        await expect(page.getByTestId("settings-title")).toBeVisible();
        await expect(page.getByTestId("nav-more-menu")).toBeHidden();
    });

    test("closes the Mehr sheet via the backdrop", async ({page}) => {
        await page.getByTestId("nav-tab-more").click();
        await expect(page.getByTestId("nav-more-menu")).toBeVisible();

        await page.getByTestId("nav-more-backdrop").click({position: {x: 10, y: 10}});
        await expect(page.getByTestId("nav-more-menu")).toBeHidden();
    });

    test("opens the global search from the search tab", async ({page}) => {
        await page.getByTestId("nav-tab-search").click();
        await expect(page.getByTestId("global-search-overlay")).toBeVisible();
    });

    test("tab bar does not cover the page content", async ({page}) => {
        // The main content's padded bottom must clear the fixed bar so
        // the last rows stay reachable when scrolled to the end.
        const mainPadding = await page
            .locator("main")
            .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
        expect(mainPadding).toBeGreaterThanOrEqual(60);
    });
});

test.describe("top nav (desktop)", () => {
    test.beforeEach(async ({page}) => {
        await page.setViewportSize(DESKTOP);
        await page.goto("/");
    });

    test("hides the tab bar and navigates via the inline links", async ({page}) => {
        await expect(page.getByTestId("topos-tabbar")).toBeHidden();

        await page.getByTestId("nav-containers").click();
        await expect(page.getByTestId("container-list-title")).toBeVisible();

        await page.getByTestId("nav-settings").click();
        await expect(page.getByTestId("settings-title")).toBeVisible();
    });
});

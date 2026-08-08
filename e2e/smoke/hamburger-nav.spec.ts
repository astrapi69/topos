/**
 * Smoke: mobile hamburger menu vs. desktop top nav.
 *
 * Mobile (<md): the top bar shows the wordmark plus a hamburger button;
 * tapping it drops down a menu with every destination and a search
 * entry. There is no bottom tab bar (removed 2026-08-08). Desktop
 * (md+): the hamburger is hidden and the inline top-nav links take
 * over.
 */

import {test, expect} from "@playwright/test";

const MOBILE = {width: 390, height: 844};
const DESKTOP = {width: 1280, height: 800};

test.describe("hamburger menu (mobile)", () => {
    test.beforeEach(async ({page}) => {
        await page.setViewportSize(MOBILE);
        await page.goto("/");
    });

    test("bottom tab bar is gone; hamburger opens the full menu", async ({page}) => {
        await expect(page.getByTestId("topos-tabbar")).toHaveCount(0);
        await expect(page.getByTestId("nav-hamburger")).toBeVisible();
        await expect(page.getByTestId("nav-mobile-menu")).toBeHidden();

        await page.getByTestId("nav-hamburger").click();
        await expect(page.getByTestId("nav-mobile-menu")).toBeVisible();
        for (const id of [
            "nav-dashboard-mobile",
            "nav-containers-mobile",
            "nav-photo-intake-mobile",
            "nav-categories-mobile",
            "nav-actions-mobile",
            "nav-import-mobile",
            "nav-settings-mobile",
            "nav-search-mobile",
        ]) {
            await expect(page.getByTestId(id)).toBeVisible();
        }
    });

    test("navigates between destinations via the menu", async ({page}) => {
        await page.getByTestId("nav-hamburger").click();
        await page.getByTestId("nav-containers-mobile").click();
        await expect(page.getByTestId("container-list-title")).toBeVisible();
        await expect(page.getByTestId("nav-mobile-menu")).toBeHidden();

        await page.getByTestId("nav-hamburger").click();
        await page.getByTestId("nav-photo-intake-mobile").click();
        await expect(page.getByTestId("photo-intake-title")).toBeVisible();

        await page.getByTestId("nav-hamburger").click();
        await page.getByTestId("nav-settings-mobile").click();
        await expect(page.getByTestId("settings-title")).toBeVisible();
    });

    test("closes the menu via the backdrop", async ({page}) => {
        await page.getByTestId("nav-hamburger").click();
        await expect(page.getByTestId("nav-mobile-menu")).toBeVisible();

        await page.getByTestId("nav-menu-backdrop").click({position: {x: 10, y: 700}});
        await expect(page.getByTestId("nav-mobile-menu")).toBeHidden();
    });

    test("opens the global search from the menu", async ({page}) => {
        await page.getByTestId("nav-hamburger").click();
        await page.getByTestId("nav-search-mobile").click();
        await expect(page.getByTestId("global-search-overlay")).toBeVisible();
        await expect(page.getByTestId("nav-mobile-menu")).toBeHidden();
    });
});

test.describe("top nav (desktop)", () => {
    test.beforeEach(async ({page}) => {
        await page.setViewportSize(DESKTOP);
        await page.goto("/");
    });

    test("hides the hamburger and navigates via the inline links", async ({page}) => {
        await expect(page.getByTestId("nav-hamburger")).toBeHidden();

        await page.getByTestId("nav-containers").click();
        await expect(page.getByTestId("container-list-title")).toBeVisible();

        await page.getByTestId("nav-settings").click();
        await expect(page.getByTestId("settings-title")).toBeVisible();
    });
});

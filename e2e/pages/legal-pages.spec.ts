/**
 * Imprint and privacy policy on the GitHub-Pages build.
 *
 * Pages has no SPA rewrite, so a direct call of /topos/impressum only
 * works because the build emits dist/impressum/index.html; and once the
 * service worker controls the page, a reload goes through workbox's
 * navigation fallback, which must land on the legal page and not on the
 * dashboard. Both are the failure modes a static-HTML approach would
 * have hit; both are pinned here.
 */
import {test, expect} from "@playwright/test";

const PAGES = [
    {path: "impressum", article: "legal-imprint", title: "legal-imprint-title", heading: /Impressum/},
    {path: "datenschutz", article: "legal-privacy", title: "legal-privacy-title", heading: /Datenschutzerklärung/},
];

const VIEWPORTS = [
    {width: 600, height: 900},
    {width: 800, height: 1000},
    {width: 1080, height: 800},
];

test.describe("legal pages on the GitHub Pages build", () => {
    for (const legal of PAGES) {
        test(`direct call of /${legal.path} answers 200 with the legal page`, async ({page}) => {
            const response = await page.goto(legal.path);
            expect(response?.status()).toBe(200);
            await expect(page.getByTestId(legal.title)).toHaveText(legal.heading);
            await expect(page.getByTestId(legal.article)).toContainText("Asterios Raptis");
            await expect(page).toHaveURL(new RegExp(`/topos/${legal.path}$`));
        });
    }

    test("reload with the service worker active still serves the legal page", async ({page}) => {
        await page.goto("");
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload();
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

        for (const legal of PAGES) {
            await page.goto(legal.path);
            await expect(page.getByTestId(legal.title)).toHaveText(legal.heading);
            await page.reload();
            await expect(page.getByTestId(legal.title)).toHaveText(legal.heading);
            await expect(page).toHaveURL(new RegExp(`/topos/${legal.path}$`));
        }
    });

    test("footer links reach both pages from the dashboard", async ({page}) => {
        await page.goto("");
        await page.getByTestId("footer-imprint-link").click();
        await expect(page.getByTestId("legal-imprint-title")).toBeVisible();
        await page.getByTestId("footer-privacy-link").click();
        await expect(page.getByTestId("legal-privacy-title")).toBeVisible();
    });

    test("Settings > About links to both pages", async ({page}) => {
        await page.goto("settings");
        await page.getByTestId("settings-tab-about").click();
        await expect(page.getByTestId("about-imprint-link")).toHaveAttribute("href", "/topos/impressum");
        await expect(page.getByTestId("about-privacy-link")).toHaveAttribute("href", "/topos/datenschutz");
    });

    for (const viewport of VIEWPORTS) {
        test(`renders with footer links at ${viewport.width}px`, async ({page}) => {
            await page.setViewportSize(viewport);
            await page.goto("datenschutz");
            await expect(page.getByTestId("legal-privacy-title")).toBeVisible();
            await expect(page.getByTestId("footer-imprint-link")).toBeVisible();
            await expect(page.getByTestId("footer-privacy-link")).toBeVisible();
        });
    }
});

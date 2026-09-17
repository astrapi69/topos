/**
 * Imprint and privacy policy on the GitHub-Pages build.
 *
 * The pages are static HTML files next to the SPA. Two things could
 * swallow them: GitHub Pages' missing SPA rewrite (does not apply, they
 * are real files) and the service worker's navigateFallback, which would
 * answer a navigation to /topos/impressum.html with the app shell. This
 * spec proves each page opens directly, survives a reload with the
 * service worker in control, never shows the app, links its siblings and
 * back to the app, and is reachable from the footer and Settings > About.
 */
import {test, expect} from "@playwright/test";

const PAGES = [
    {path: "impressum.html", root: "legal-page-impressum", sibling: "datenschutz.html"},
    {path: "datenschutz.html", root: "legal-page-datenschutz", sibling: "impressum.html"},
    {path: "imprint.html", root: "legal-page-imprint", sibling: "privacy.html"},
    {path: "privacy.html", root: "legal-page-privacy", sibling: "imprint.html"},
] as const;

const VIEWPORTS = [
    {width: 600, height: 900},
    {width: 800, height: 1000},
    {width: 1080, height: 800},
];

for (const legal of PAGES) {
    test(`${legal.path} opens directly with 200 and is not the app`, async ({page}) => {
        const response = await page.goto(legal.path);
        expect(response?.status()).toBe(200);
        await expect(page.getByTestId(legal.root)).toBeVisible();
        await expect(page.getByTestId("topos-navbar")).toHaveCount(0);
        await expect(page.getByTestId("legal-link-app")).toHaveAttribute("href", "./");
        await expect(page.locator(`nav a[href="./${legal.sibling}"]`)).toBeVisible();
        await expect(page.locator('a[href="mailto:asterios.raptis@web.de"]').first()).toBeVisible();
    });
}

test("with the service worker in control, every legal page still loads and reloads", async ({page}) => {
    await page.goto("");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    for (const legal of PAGES) {
        await page.goto(legal.path);
        await expect(page.getByTestId(legal.root)).toBeVisible();
        await expect(page.getByTestId("topos-navbar")).toHaveCount(0);
        await page.reload();
        await expect(page.getByTestId(legal.root)).toBeVisible();
    }
});

test("the built service worker excludes the legal pages from the SPA fallback", async ({request}) => {
    const response = await request.get("sw.js");
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("impressum|datenschutz|imprint|privacy");
});

test("the footer leads from the dashboard to both legal pages and back", async ({page}) => {
    await page.goto("");
    await page.getByTestId("legal-footer-imprint").click();
    await expect(page.getByTestId("legal-page-impressum")).toBeVisible();
    await page.getByTestId("legal-link-privacy").click();
    await expect(page.getByTestId("legal-page-datenschutz")).toBeVisible();
    await page.getByTestId("legal-link-app").click();
    await expect(page.getByTestId("topos-navbar")).toBeVisible();
});

test("Settings > About links to both legal pages", async ({page}) => {
    await page.goto("settings");
    await page.getByTestId("settings-tab-about").click();
    await expect(page.getByTestId("about-imprint-link")).toHaveAttribute("href", "/topos/impressum.html");
    await expect(page.getByTestId("about-privacy-link")).toHaveAttribute("href", "/topos/datenschutz.html");
});

test("the in-app dark theme carries over to the legal pages", async ({page}) => {
    await page.addInitScript(() => localStorage.setItem("topos-app-theme", "ocean"));
    await page.goto("datenschutz.html");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const viewport of VIEWPORTS) {
    test(`footer and privacy page render at ${viewport.width}px`, async ({page}) => {
        await page.setViewportSize(viewport);
        await page.goto("");
        await expect(page.getByTestId("legal-footer-imprint")).toBeVisible();
        await expect(page.getByTestId("legal-footer-privacy")).toBeVisible();
        await page.goto("datenschutz.html");
        await expect(page.getByTestId("legal-page-datenschutz")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
    });
}

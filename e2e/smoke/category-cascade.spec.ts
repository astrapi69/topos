/**
 * Smoke: category rename/delete actions + orphan report section.
 *
 * Backend mode only - the cascade mutations and the orphan report
 * need the API. Covers: action buttons render on tree nodes, the
 * rename prompt opens pre-filled, the orphan section appears in
 * Settings. Destructive flows stay in the backend integration tests
 * (tests/routers/test_category_cascade.py) - this smoke must not
 * mutate whatever data the running app carries.
 */

import {test, expect} from "@playwright/test";

const MOBILE = {width: 390, height: 844};

test.describe("category cascade UI", () => {
    test("tree nodes carry rename and delete actions", async ({page}) => {
        await page.goto("/categories");
        await expect(page.getByTestId("category-tree")).toBeVisible();

        const rename = page.locator('[data-testid^="category-rename-"]').first();
        const remove = page.locator('[data-testid^="category-delete-"]').first();
        if ((await rename.count()) === 0) {
            test.skip(true, "no categories in the running app - nothing to smoke");
        }
        await expect(rename).toBeVisible();
        await expect(remove).toBeVisible();
    });

    test("rename opens a prompt pre-filled with the current path", async ({page}) => {
        await page.goto("/categories");
        const rename = page.locator('[data-testid^="category-rename-"]').first();
        if ((await rename.count()) === 0) {
            test.skip(true, "no categories in the running app - nothing to smoke");
        }
        const testId = await rename.getAttribute("data-testid");
        const slug = testId!.replace("category-rename-", "");

        await rename.click();
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible();
        // The prompt default is the node's real path; the testid slug
        // replaces "/" with "-", so compare on the transformed form.
        const value = await input.inputValue();
        expect(value.replace(/\//g, "-")).toBe(slug);
        await page.getByTestId("app-dialog-cancel").click();
    });

    test("orphan section renders in settings at phone width", async ({page}) => {
        await page.setViewportSize(MOBILE);
        await page.goto("/settings?tab=maintenance");
        await expect(page.getByTestId("settings-title")).toBeVisible();
        await expect(page.getByTestId("orphan-paths-section")).toBeVisible();
    });
});

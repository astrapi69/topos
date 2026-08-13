/**
 * Curated container types: the Settings toggle offers the optional
 * types (drawer/shelf/case/safe), the create form honours it, and the
 * tree groups the new type on its own - while folder and box stay the
 * untouchable defaults.
 */

import {expect, test} from "@playwright/test";

test.describe("container types", () => {
    test("enable drawer in settings, create one, see it grouped", async ({page}) => {
        // --- the toggle exists and the defaults are not toggleable ---
        await page.goto("/settings?tab=general");
        const section = page.getByTestId("container-types-section");
        await expect(section).toBeVisible();
        await expect(section.getByTestId("container-type-toggle-drawer")).toBeVisible();
        await expect(
            section.locator('[data-testid="container-type-toggle-folder"]'),
        ).toHaveCount(0);

        // --- before enabling: the create form offers only the defaults ---
        await page.goto("/containers");
        await page.getByTestId("container-new-button").click();
        const typeSelect = page.getByTestId("container-form-type");
        await expect(typeSelect.locator("option")).toHaveCount(2);

        // --- enable drawer ---
        await page.goto("/settings?tab=general");
        await page.getByTestId("container-type-toggle-drawer").check();

        // --- create a drawer container ---
        await page.goto("/containers");
        await page.getByTestId("container-new-button").click();
        await expect(typeSelect.locator("option")).toHaveCount(3);
        await page.getByTestId("container-form-external-id").fill("77");
        await page.getByTestId("container-form-label").fill("Kommode links");
        await typeSelect.selectOption("drawer");
        await page.getByTestId("container-form-submit").click();

        // The list shows the row with its translated type.
        const table = page.getByTestId("container-table");
        await expect(table.getByText("Kommode links")).toBeVisible();

        // --- the tree derives a group for the new type ---
        await page.getByTestId("container-view-tree").click();
        const tree = page.getByTestId("inventory-tree");
        await expect(tree.getByTestId("tree-node-group:drawer:self")).toBeVisible();
        await expect(tree.getByText("Kommode links")).toBeVisible();

        // Back to the list for the next spec.
        await page.getByTestId("container-view-list").click();
    });
});

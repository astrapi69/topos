/**
 * Smoke: the tree view on the Containers page.
 *
 * The inventory rendered as the forest it really is: the app root "Topos",
 * under it the (type, owner) groups the Excel workbook calls its sheets,
 * under those the containers, and the items as leaves. The toggle sits next
 * to "Etiketten drucken"; the choice persists across a reload.
 *
 * Creates its own container + item through the UI, so the spec carries its
 * data and runs against an empty backend too.
 *
 * data-testid selectors only (no brittle CSS).
 */

import {expect, test} from "@playwright/test";

const STAMP = Date.now() % 100000;
const CONTAINER_NR = String(90000 + STAMP);
const CONTAINER_LABEL = `Baum-Smoke ${STAMP}`;
const ITEM_CONTENT = `Blatt-Eintrag ${STAMP}`;

test.describe("container tree view", () => {
    test("tree shows root, group, container and item; choice persists", async ({page}) => {
        // --- seed through the UI ---
        await page.goto("/containers");
        await page.getByTestId("container-new-button").click();
        await page.getByTestId("container-form-external-id").fill(CONTAINER_NR);
        await page.getByTestId("container-form-label").fill(CONTAINER_LABEL);
        await page.getByTestId("container-form-submit").click();
        await expect(page.getByText(CONTAINER_LABEL)).toBeVisible();

        await page.getByText(CONTAINER_LABEL).click();
        await page.getByTestId("container-detail-new-item").click();
        await page.getByTestId("item-editor-content-input").fill(ITEM_CONTENT);
        await page.getByTestId("item-editor-submit").click();
        await expect(page.getByText(ITEM_CONTENT)).toBeVisible();

        // --- switch to the tree ---
        await page.goto("/containers");
        await page.getByTestId("container-view-tree").click();
        await expect(page.getByTestId("inventory-tree")).toBeVisible();

        // Root and group levels are open by default.
        await expect(page.getByTestId("tree-node-root")).toContainText("Topos");
        await expect(page.getByTestId("tree-node-group:folder:self")).toBeVisible();

        // The container is there; its items are not, until expanded.
        // Scoped to the tree: the list stays in the DOM under `hidden`
        // when the tree is active, so a page-wide getByText resolves the
        // label twice and trips Playwright's strict mode.
        const tree = page.getByTestId("inventory-tree");
        await expect(tree.getByText(CONTAINER_LABEL)).toBeVisible();
        await expect(tree.getByText(ITEM_CONTENT)).toBeHidden();

        // Expand: the item leaf appears, numbered container-item.
        const row = page
            .locator(`[data-testid^="tree-node-container:"]`)
            .filter({hasText: CONTAINER_LABEL});
        await row.locator(`[data-testid^="tree-toggle-"]`).click();
        await expect(tree.getByText(ITEM_CONTENT)).toBeVisible();
        await expect(tree.getByText(`${CONTAINER_NR}-1`)).toBeVisible();

        // The item leaf links into the editor.
        await page
            .locator(`[data-testid^="tree-link-item:"]`)
            .filter({hasText: ITEM_CONTENT})
            .click();
        await expect(page.getByTestId("item-editor-form")).toBeVisible();

        // --- persistence: the tree choice survives a reload ---
        await page.goto("/containers");
        await expect(page.getByTestId("inventory-tree")).toBeVisible();

        // Back to the list for the next spec.
        await page.getByTestId("container-view-list").click();
        await expect(page.getByTestId("container-table")).toBeVisible();
    });

    test("filters apply to the tree as well", async ({page}) => {
        await page.goto("/containers");

        // The type filter is data-driven (it offers the types that occur),
        // so make sure a box exists before filtering by it.
        await page.getByTestId("container-new-button").click();
        await page.getByTestId("container-form-external-id").fill("88");
        await page.getByTestId("container-form-label").fill("Filter-Box");
        await page.getByTestId("container-form-type").selectOption("box");
        await page.getByTestId("container-form-submit").click();
        await expect(
            page.getByTestId("container-table").getByText("Filter-Box"),
        ).toBeVisible();

        await page.getByTestId("container-view-tree").click();

        // Filtering by box hides the folder group entirely (its containers
        // are folders), rather than showing an empty shell.
        await page.getByTestId("filter-type").selectOption("box");
        await expect(page.getByTestId("tree-node-group:folder:self")).toBeHidden();

        await page.getByTestId("filter-type").selectOption("all");
        await expect(page.getByTestId("tree-node-group:folder:self")).toBeVisible();

        await page.getByTestId("container-view-list").click();
    });
});

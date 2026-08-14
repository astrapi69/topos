/**
 * Moving in the tree via the "Verschieben nach..." menu - the surface
 * that must work everywhere (touch, keyboard, screen reader). The drag
 * gesture shares the exact same rule set (treeMove.ts, unit-pinned), so
 * the menu path exercising the full stack - dialog -> storage write ->
 * refresh -> rebuilt tree - is the load-bearing E2E check; the gesture
 * itself stays a manual device check.
 */

import {expect, test} from "@playwright/test";

async function createContainer(
    page: import("@playwright/test").Page,
    nr: string,
    label: string,
) {
    await page.getByTestId("container-new-button").click();
    await page.getByTestId("container-form-external-id").fill(nr);
    await page.getByTestId("container-form-label").fill(label);
    await page.getByTestId("container-form-submit").click();
    await expect(
        page.getByTestId("container-table").getByText(label),
    ).toBeVisible();
}

test.describe("tree move", () => {
    test("nest a container via the menu, then detach it", async ({page}) => {
        await page.goto("/containers");
        await createContainer(page, "301", "Move-Regal");
        await createContainer(page, "302", "Move-Ordner");

        await page.getByTestId("container-view-tree").click();
        const tree = page.getByTestId("inventory-tree");
        await expect(tree).toBeVisible();

        // --- nest: Ordner 302 into Regal 301 via the move menu ---
        const folderRow = tree.locator('[data-testid^="tree-node-container:"]', {
            hasText: "Move-Ordner",
        });
        // Container id is local, so target the choice by its label text.
        await folderRow.locator('[data-testid^="tree-move-"]').click();
        await page
            .locator('[data-testid^="app-dialog-choice-container:"]', {
                hasText: "Move-Regal",
            })
            .click();

        // The tree rebuilds: the folder now hangs under the shelf.
        const shelfRow = tree.locator('[data-testid^="tree-node-container:"]', {
            hasText: "Move-Regal",
        });
        await shelfRow.locator('[data-testid^="tree-toggle-"]').click();
        await expect(
            tree.locator('[data-testid^="tree-node-container:"]', {
                hasText: "Move-Ordner",
            }),
        ).toBeVisible();

        // --- detach: back to the top level via the root option ---
        await tree
            .locator('[data-testid^="tree-node-container:"]', {
                hasText: "Move-Ordner",
            })
            .locator('[data-testid^="tree-move-"]')
            .click();
        await page.getByTestId("app-dialog-choice-root").click();

        // Still visible, now top-level again (folder group reappears).
        await expect(
            tree.getByTestId("tree-node-group:folder:self"),
        ).toBeVisible();

        // Back to the list for the next spec.
        await page.getByTestId("container-view-list").click();
    });
});

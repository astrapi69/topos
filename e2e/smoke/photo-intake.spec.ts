/**
 * Smoke: the photo-intake flow (capture -> recognize -> staging ->
 * commit) against a live backend, with the AI vision call mocked via
 * page.route so no provider key, network call, or cost is involved.
 * The bulk commit runs against the real endpoint.
 *
 * Covers the happy path plus the layout-critical viewports (600 /
 * 800 / 1080) per ai-workflow.md. data-testid selectors only.
 */

import {expect, test, type Page} from "@playwright/test";

import {resetDb} from "../helpers/api";

const API = "http://localhost:8010/api";

// 1x1 PNG; the page downscales/re-encodes it client-side before upload.
const TINY_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

const VISION_RESPONSE = {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    items: [
        {
            label: "Steuerbescheid 2023",
            category_path: "finance/tax",
            new_category_hint: "",
            description: "Einkommensteuerbescheid",
            confidence: 0.9,
        },
        {
            label: "Altes Ladekabel",
            category_path: "",
            new_category_hint: "electronics-cables",
            description: "USB-Kabel, verknotet",
            confidence: 0.42,
        },
    ],
};

async function createContainer(): Promise<number> {
    const response = await fetch(`${API}/containers`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            external_id: 9001,
            type: "box",
            owner: "self",
            label: "Photo intake smoke box",
        }),
    });
    if (!response.ok) throw new Error(`container setup failed: ${response.status}`);
    const created = await response.json();
    return created.id as number;
}

async function mockVision(page: Page): Promise<void> {
    await page.route("**/api/ai/vision", (route) =>
        route.fulfill({json: VISION_RESPONSE}),
    );
}

async function captureAndRecognize(page: Page, containerId: number): Promise<void> {
    await page.goto("/photo-intake");
    await expect(page.getByTestId("photo-intake-title")).toBeVisible();

    await page.getByTestId("photo-intake-container-select").selectOption(String(containerId));
    await page.getByTestId("photo-intake-file-input").setInputFiles({
        name: "box.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
    });
    await expect(page.getByTestId("photo-intake-preview")).toBeVisible();

    await expect(page.getByTestId("photo-intake-recognize")).toBeEnabled();
    await page.getByTestId("photo-intake-recognize").click();

    // Privacy notice before the first recognition; confirming proceeds.
    await expect(page.getByTestId("app-dialog-confirm")).toBeVisible();
    await page.getByTestId("app-dialog-confirm").click();

    await expect(page.getByTestId("photo-intake-row-0")).toBeVisible();
}

test.beforeEach(async () => {
    await resetDb();
});

test.afterEach(async () => {
    await resetDb();
});

test("photo intake: happy path from capture to committed items", async ({page}) => {
    const containerId = await createContainer();
    await mockVision(page);
    await captureAndRecognize(page, containerId);

    // Staging shows both suggestions with editable labels + confidence.
    await expect(page.getByTestId("photo-intake-row-0-label")).toHaveValue(
        "Steuerbescheid 2023",
    );
    await expect(page.getByTestId("photo-intake-row-0-confidence")).toContainText("90%");
    await expect(page.getByTestId("photo-intake-row-1-confidence")).toContainText("42%");

    // Edit one label; confirm the new-category suggestion on row 1.
    await page.getByTestId("photo-intake-row-0-label").fill("Steuerbescheid 2023 (Kopie)");
    await page.getByTestId("photo-intake-row-1-category").selectOption("__new__");

    await page.getByTestId("photo-intake-commit").click();

    // Full success navigates to the container detail page.
    await expect(page).toHaveURL(new RegExp(`/containers/${containerId}$`));

    // The items really landed in the backend, category chain included.
    const items = await (await fetch(`${API}/items?container_id=${containerId}`)).json();
    const contents = items.map((item: {content: string}) => item.content).sort();
    expect(contents).toEqual(["Altes Ladekabel", "Steuerbescheid 2023 (Kopie)"]);
    const cable = items.find((item: {content: string}) => item.content === "Altes Ladekabel");
    expect(cable.category_path).toBe("electronics-cables");
    const categories = await (await fetch(`${API}/categories`)).json();
    expect(categories.map((cat: {path: string}) => cat.path)).toContain("electronics-cables");
});

test("photo intake: staging edits - deselect, remove, manual row", async ({page}) => {
    const containerId = await createContainer();
    await mockVision(page);
    await captureAndRecognize(page, containerId);

    // Deselect all: the commit button disables (0 committable rows).
    await page.getByTestId("photo-intake-deselect-all").click();
    await expect(page.getByTestId("photo-intake-commit")).toBeDisabled();

    // Select all again, drop row 1, add a manual row instead.
    await page.getByTestId("photo-intake-select-all").click();
    await page.getByTestId("photo-intake-row-1-remove").click();
    await page.getByTestId("photo-intake-add-manual").click();
    await page.getByTestId("photo-intake-row-1-label").fill("Handnotiz");

    await page.getByTestId("photo-intake-commit").click();
    await expect(page).toHaveURL(new RegExp(`/containers/${containerId}$`));

    const items = await (await fetch(`${API}/items?container_id=${containerId}`)).json();
    const contents = items.map((item: {content: string}) => item.content).sort();
    expect(contents).toEqual(["Handnotiz", "Steuerbescheid 2023"]);
});

test("photo intake: inline container creation selects the new container", async ({
    page,
}) => {
    await page.goto("/photo-intake");
    await expect(page.getByTestId("photo-intake-title")).toBeVisible();

    // Expand the quick-create form (required fields only).
    await expect(page.getByTestId("container-quick-create-toggle")).toBeEnabled();
    await page.getByTestId("container-quick-create-toggle").click();
    await page.getByTestId("container-quick-create-external-id").fill("9002");
    await page.getByTestId("container-quick-create-label").fill("Inline angelegte Box");
    await page.getByTestId("container-quick-create-submit").click();

    // The form collapses and the fresh container is the selected target.
    await expect(page.getByTestId("container-quick-create-form")).toHaveCount(0);
    await expect(page.getByTestId("photo-intake-container-select")).toContainText(
        "9002 - Inline angelegte Box",
    );
    const selectedId = await page
        .getByTestId("photo-intake-container-select")
        .inputValue();
    expect(Number(selectedId)).toBeGreaterThan(0);

    // The container really exists in the backend.
    const containers = await (await fetch(`${API}/containers`)).json();
    const created = containers.find(
        (container: {external_id: number}) => container.external_id === 9002,
    );
    expect(created.label).toBe("Inline angelegte Box");
    expect(String(created.id)).toBe(selectedId);
});

for (const width of [600, 800, 1080]) {
    test(`photo intake: layout at ${width}px keeps all controls reachable`, async ({
        page,
    }) => {
        await page.setViewportSize({width, height: 900});
        const containerId = await createContainer();
        await mockVision(page);
        await captureAndRecognize(page, containerId);

        await expect(page.getByTestId("photo-intake-take-photo")).toBeVisible();
        await expect(page.getByTestId("photo-intake-upload")).toBeVisible();
        await expect(page.getByTestId("photo-intake-row-0-category")).toBeVisible();
        await expect(page.getByTestId("photo-intake-commit")).toBeVisible();
        // No horizontal page scroll at any of the tested widths.
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
}

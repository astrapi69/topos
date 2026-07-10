/**
 * Smoke: the AI provider settings section on the Settings page.
 *
 * Verifies the section renders against a live backend and that the
 * provider switch drives the model/base-url controls client-side.
 * Deliberately does NOT click Save (would write the config overlay) or
 * Test (would make a real provider network call) against the backend -
 * this stays a side-effect-free smoke.
 *
 * The local-mode spec blocks the AI settings endpoints to force the
 * no-backend fallback (adaptive-learner pattern): the same form stays
 * usable and persists to localStorage only.
 */

import {expect, test} from "@playwright/test";

test("AI settings: section renders with provider, model and key controls", async ({
    page,
}) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-title")).toBeVisible();

    // The section only mounts when the AI endpoints answer.
    await expect(page.getByTestId("ai-settings-section")).toBeVisible();
    await expect(page.getByTestId("ai-enable-toggle")).toBeVisible();
    await expect(page.getByTestId("ai-provider-select")).toBeVisible();
    await expect(page.getByTestId("ai-model-select")).toBeVisible();
    await expect(page.getByTestId("ai-key-input")).toBeVisible();
    await expect(page.getByTestId("ai-save-button")).toBeVisible();
    await expect(page.getByTestId("ai-test-button")).toBeVisible();
});

test("AI settings: model dropdown marks vision-capable models", async ({page}) => {
    await page.goto("/settings");
    await expect(page.getByTestId("ai-model-select")).toBeVisible();
    // The built-in providers suggest only vision-capable models, labelled
    // with a "- Vision" suffix.
    const optionText = await page
        .getByTestId("ai-model-select")
        .locator("option")
        .first()
        .innerText();
    expect(optionText).toContain("Vision");
});

test("AI settings: custom provider reveals the base-url field", async ({page}) => {
    await page.goto("/settings");
    await expect(page.getByTestId("ai-provider-select")).toBeVisible();

    await page.getByTestId("ai-provider-select").selectOption("custom");

    await expect(page.getByTestId("ai-base-url-input")).toBeVisible();
    // Custom has no preset models -> a free-text model input replaces the select.
    await expect(page.getByTestId("ai-model-input")).toBeVisible();
    await expect(page.getByTestId("ai-model-select")).toHaveCount(0);
});

test("AI settings: no backend falls back to the browser-local mode", async ({page}) => {
    // Kill the AI settings endpoints so the section switches to local mode.
    await page.route("**/api/settings/ai/**", (route) => route.abort());
    await page.goto("/settings");

    await expect(page.getByTestId("ai-settings-local-hint")).toBeVisible();
    // The SAME form stays usable - never a dead "needs a backend" stub.
    await expect(page.getByTestId("ai-enable-toggle")).toBeVisible();
    await expect(page.getByTestId("ai-provider-select")).toBeVisible();
    await expect(page.getByTestId("ai-model-select")).toBeVisible();
    await expect(page.getByTestId("ai-test-button")).toBeVisible();

    // Saving persists to localStorage only (keys never leave the browser).
    await page.getByTestId("ai-enable-toggle").check();
    await page.getByTestId("ai-key-input").fill("sk-local-e2e");
    await page.getByTestId("ai-save-button").click();
    await expect(page.getByTestId("ai-key-configured")).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("topos.ai_config"));
    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.enabled).toBe(true);
    expect(parsed.keys.anthropic).toBe("sk-local-e2e");
});

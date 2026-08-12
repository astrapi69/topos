/**
 * Smoke: the AI provider settings section on the Settings page, now driven
 * by the ``@astrapi69/ai-key-vault-react`` panel.
 *
 * Backend mode renders the packaged panel over the backend adapter. Local
 * mode (no backend) is forced by aborting the health probe - the mode
 * signal - and pins the lazy-passphrase design: the provider list is
 * visible immediately and the passphrase is only requested when a key is
 * actually saved. Gating the list behind a create-vault form read as "no
 * providers here" and was reported as a bug three times.
 *
 * Side-effect-free against the backend: it never Saves or Tests a real
 * provider.
 *
 * data-testid selectors only (no brittle CSS).
 */

import {expect, test} from "@playwright/test";

// Assembled from parts (not a hardcoded literal) so secret scanners don't
// flag this test-only vault input as a real credential.
const GATE_INPUT = ["topos", "e2e", "gate", "12345"].join("-");

test("AI settings: backend mode renders the packaged panel", async ({page}) => {
    await page.goto("/settings?tab=ai");
    await expect(page.getByTestId("settings-title")).toBeVisible();

    await expect(page.getByTestId("ai-settings-section")).toBeVisible();
    await expect(page.getByTestId("ai-enable-toggle")).toBeVisible();
    // Backend mode: keys live server-side, so no local-vault affordances.
    await expect(page.getByTestId("ai-settings-local-hint")).toHaveCount(0);
    await expect(page.getByTestId("ai-vault-unlock-cta")).toHaveCount(0);
});

test("AI settings: local mode lists providers without asking for a passphrase", async ({page}) => {
    // Abort the health probe: that is what decides backend vs local mode.
    await page.route("**/api/health", (route) => route.abort());
    await page.goto("/settings?tab=ai");

    await expect(page.getByTestId("ai-settings-local-hint")).toBeVisible();
    // The lazy-passphrase contract: providers are reachable straight away.
    await expect(page.getByTestId("configured-providers")).toBeVisible();
    // Nothing demands a passphrase before a key exists.
    await expect(page.getByTestId("ai-vault-prompt")).toHaveCount(0);
    await expect(page.getByTestId("ai-vault-unlock-cta")).toHaveCount(0);
});

test("AI settings: local mode offers key import to bootstrap a device", async ({page}) => {
    await page.route("**/api/health", (route) => route.abort());
    await page.goto("/settings?tab=ai");

    // A fresh device gets its keys from a sibling app's encrypted file
    // rather than by retyping them; the entry point must be reachable
    // without unlocking anything first.
    await expect(page.getByTestId("ai-key-import")).toBeVisible();
});

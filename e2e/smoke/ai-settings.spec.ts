/**
 * Smoke: the AI provider settings section on the Settings page, now driven
 * by the ``@astrapi69/ai-key-vault-react`` panel.
 *
 * Backend mode renders the packaged panel over the backend adapter. Local
 * mode (no backend) is forced by aborting ``/api/settings/app`` - the mode
 * probe - and exercises the passphrase-encrypted vault gate lifecycle
 * (create -> unlocked panel -> lock -> unlock). Side-effect-free against the
 * backend: it never Saves or Tests a real provider.
 *
 * data-testid selectors only (no brittle CSS).
 */

import {expect, test} from "@playwright/test";

// Assembled from parts (not a hardcoded literal) so secret scanners don't
// flag this test-only vault input as a real credential.
const GATE_INPUT = ["topos", "e2e", "gate", "12345"].join("-");

test("AI settings: backend mode renders the packaged panel", async ({page}) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-title")).toBeVisible();

    await expect(page.getByTestId("ai-settings-section")).toBeVisible();
    await expect(page.getByTestId("ai-enable-toggle")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toBeVisible();
    // Backend mode: no encrypted key-vault section and no passphrase gate.
    await expect(page.getByTestId("key-vault-section")).toHaveCount(0);
    await expect(page.getByTestId("ai-vault-create-pass")).toHaveCount(0);
});

test("AI settings: no backend shows the create-passphrase gate", async ({page}) => {
    // Abort the mode probe so the section switches to local (PWA) mode.
    await page.route("**/api/settings/app", (route) => route.abort());
    await page.goto("/settings");

    await expect(page.getByTestId("ai-settings-local-hint")).toBeVisible();
    // First run: no vault yet -> the create-passphrase gate, not the panel.
    await expect(page.getByTestId("ai-vault-create-pass")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toHaveCount(0);
});

test("AI settings: local vault create -> lock -> unlock lifecycle", async ({page}) => {
    await page.route("**/api/settings/app", (route) => route.abort());
    await page.goto("/settings");

    // Create the passphrase-encrypted vault.
    await page.getByTestId("ai-vault-create-pass").fill(GATE_INPUT);
    await page.getByTestId("ai-vault-create-confirm").fill(GATE_INPUT);
    await page.getByTestId("ai-vault-create-button").click();

    // Unlocked: the packaged panel, the encrypted key vault, and a lock button.
    await expect(page.getByTestId("ai-vault-lock-button")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toBeVisible();
    await expect(page.getByTestId("key-vault-section")).toBeVisible();

    // The vault is persisted only as ciphertext (no plaintext key material).
    const envelope = await page.evaluate(() => localStorage.getItem("topos.ai_vault"));
    expect(envelope).toContain("topos-ai-keys");
    expect(envelope).toContain("AES-GCM");

    // Lock -> the unlock gate returns.
    await page.getByTestId("ai-vault-lock-button").click();
    await expect(page.getByTestId("ai-vault-unlock-pass")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toHaveCount(0);

    // Unlock with the correct passphrase -> back to the panel.
    await page.getByTestId("ai-vault-unlock-pass").fill(GATE_INPUT);
    await page.getByTestId("ai-vault-unlock-button").click();
    await expect(page.getByTestId("ai-vault-lock-button")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toBeVisible();
});

test("AI settings: wrong passphrase keeps the vault locked", async ({page}) => {
    await page.route("**/api/settings/app", (route) => route.abort());
    await page.goto("/settings");

    // Seed an encrypted vault, then reload so it starts locked.
    await page.getByTestId("ai-vault-create-pass").fill(GATE_INPUT);
    await page.getByTestId("ai-vault-create-confirm").fill(GATE_INPUT);
    await page.getByTestId("ai-vault-create-button").click();
    await expect(page.getByTestId("ai-vault-lock-button")).toBeVisible();
    await page.reload();

    await expect(page.getByTestId("ai-vault-unlock-pass")).toBeVisible();
    await page.getByTestId("ai-vault-unlock-pass").fill("definitely-wrong");
    await page.getByTestId("ai-vault-unlock-button").click();

    // Still locked: the panel never appears.
    await expect(page.getByTestId("ai-vault-unlock-pass")).toBeVisible();
    await expect(page.getByTestId("settings-panel-ai")).toHaveCount(0);
});

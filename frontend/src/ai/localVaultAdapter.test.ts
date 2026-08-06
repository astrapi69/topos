import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalVaultAdapter } from "./localVaultAdapter";
import * as vault from "./localVaultStore";

// The live-test path talks to the network; stub it so the adapter tests are
// deterministic and offline.
vi.mock("./browserAiClient", () => ({
  testAiConnectionDirect: vi.fn(async () => ({ ok: true, errorCode: null })),
}));

const PASS = "correct horse battery";
const KEY = "sk-ant-" + "x".repeat(40);

beforeEach(() => {
  localStorage.clear();
  vault._resetSessionForTest();
});

describe("createLocalVaultAdapter - lazy passphrase", () => {
  it("prompts (ensureUnlocked) on setApiKey when locked, then stores the key", async () => {
    // ensureUnlocked creates the vault, standing in for the passphrase dialog.
    const ensureUnlocked = vi.fn(async () => {
      await vault.createVault(PASS);
      return true;
    });
    const adapter = createLocalVaultAdapter(ensureUnlocked);

    expect(vault.isUnlocked()).toBe(false);
    const snap = await adapter.setApiKey("topos", "anthropic", KEY);

    expect(ensureUnlocked).toHaveBeenCalledOnce();
    expect(snap.hasKey.anthropic).toBe(true);
    expect(vault.getKeys().anthropic).toBe(KEY);
  });

  it("aborts the key save when the user cancels the passphrase prompt", async () => {
    const ensureUnlocked = vi.fn(async () => false); // user cancelled
    const adapter = createLocalVaultAdapter(ensureUnlocked);

    const snap = await adapter.setApiKey("topos", "anthropic", KEY);

    expect(ensureUnlocked).toHaveBeenCalledOnce();
    expect(snap.hasKey.anthropic).toBe(false);
    expect(vault.hasVault()).toBe(false);
  });

  it("does not prompt when a key is saved into an already-unlocked vault", async () => {
    await vault.createVault(PASS); // unlocked
    const ensureUnlocked = vi.fn(async () => true);
    const adapter = createLocalVaultAdapter(ensureUnlocked);

    await adapter.setApiKey("topos", "anthropic", KEY);

    expect(ensureUnlocked).not.toHaveBeenCalled();
    expect(vault.getKeys().anthropic).toBe(KEY);
  });

  it("routes non-secret settings to plaintext metadata while locked", async () => {
    const adapter = createLocalVaultAdapter(async () => false);

    const snap = await adapter.patchSettings("topos", {
      activeProvider: "openai",
      modelOverride: { openai: "gpt-4o" },
    });

    // No session was opened, but the choice persisted to the metadata.
    expect(vault.isUnlocked()).toBe(false);
    expect(vault.getMeta().activeProvider).toBe("openai");
    expect(vault.getMeta().models.openai).toBe("gpt-4o");
    expect(snap.activeProvider).toBe("openai");
  });

  it("seeds the vault from pre-passphrase metadata choices on create", async () => {
    const adapter = createLocalVaultAdapter(async () => true);
    // Pick a provider + model before any passphrase exists.
    await adapter.patchSettings("topos", {
      activeProvider: "openai",
      modelOverride: { openai: "gpt-4o" },
    });

    await vault.createVault(PASS); // seeds from metadata

    expect(vault.getSettings().activeProvider).toBe("openai");
    expect(vault.getSettings().models.openai).toBe("gpt-4o");
  });
});

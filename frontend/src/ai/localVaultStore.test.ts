/**
 * Tests for the passphrase-encrypted local AI key vault.
 *
 * The load-bearing guarantees: keys are persisted only as ciphertext, an
 * unlock session is required to read them, a wrong passphrase never opens the
 * vault, and the plaintext metadata reflects state while locked so the UI /
 * intake gate keep working.
 */

import {beforeEach, describe, expect, it} from "vitest";
import {VaultDecryptError} from "@astrapi69/passphrase-vault";

import * as vault from "./localVaultStore";

const PASS = "correct horse battery staple";

beforeEach(() => {
    localStorage.clear();
    vault._resetSessionForTest();
});

describe("localVaultStore", () => {
    it("roundtrips keys through create/lock/unlock", async () => {
        await vault.createVault(PASS);
        expect(vault.hasVault()).toBe(true);
        expect(vault.isUnlocked()).toBe(true);

        await vault.setKey("anthropic", "sk-ant-secret-value-1234567890");
        expect(vault.getKeys().anthropic).toBe("sk-ant-secret-value-1234567890");

        vault.lock();
        expect(vault.isUnlocked()).toBe(false);
        expect(() => vault.getKeys()).toThrow();

        await vault.unlock(PASS);
        expect(vault.isUnlocked()).toBe(true);
        expect(vault.getKeys().anthropic).toBe("sk-ant-secret-value-1234567890");
    });

    it("persists keys only as ciphertext", async () => {
        await vault.createVault(PASS);
        await vault.setKey("anthropic", "sk-ant-plaintext-should-not-leak");

        const stored = localStorage.getItem("topos.ai_vault") ?? "";
        expect(stored).not.toContain("sk-ant-plaintext-should-not-leak");
        // It is a well-formed Topos vault envelope.
        expect(stored).toContain("topos-ai-keys");
        expect(stored).toContain("AES-GCM");
    });

    it("rejects a wrong passphrase and stays locked", async () => {
        await vault.createVault(PASS);
        await vault.setKey("anthropic", "sk-ant-value-1234567890abcd");
        vault.lock();

        await expect(vault.unlock("wrong passphrase")).rejects.toBeInstanceOf(
            VaultDecryptError,
        );
        expect(vault.isUnlocked()).toBe(false);
    });

    it("keeps secret-free metadata readable while locked", async () => {
        await vault.createVault(PASS);
        vault.setEnabled(true);
        await vault.setKey("anthropic", "sk-ant-value-1234567890abcd");
        await vault.patchSettings({models: {anthropic: "claude-opus-4-8"}});
        vault.lock();

        const meta = vault.getMeta();
        expect(meta.enabled).toBe(true);
        expect(meta.hasKey.anthropic).toBe(true);
        expect(meta.activeProvider).toBe("anthropic");
        expect(meta.models.anthropic).toBe("claude-opus-4-8");
        // The metadata carries no key material.
        expect(JSON.stringify(meta)).not.toContain("sk-ant-value");
    });

    it("resolves the active provider only when enabled + unlocked + keyed", async () => {
        await vault.createVault(PASS);
        // Not enabled yet.
        await vault.setKey("anthropic", "sk-ant-value-1234567890abcd");
        expect(vault.resolveActiveProvider()).toBeNull();

        vault.setEnabled(true);
        const resolved = vault.resolveActiveProvider();
        expect(resolved).not.toBeNull();
        expect(resolved?.providerId).toBe("anthropic");
        expect(resolved?.apiKey).toBe("sk-ant-value-1234567890abcd");
        expect(resolved?.baseUrl).toBe("https://api.anthropic.com/v1");
        expect(resolved?.model).toBe("claude-sonnet-4-6");

        vault.lock();
        expect(vault.resolveActiveProvider()).toBeNull();
    });

    it("survives the enabled flag across lock and destroys cleanly", async () => {
        await vault.createVault(PASS);
        vault.setEnabled(true);
        vault.lock();
        expect(vault.isEnabled()).toBe(true);

        vault.destroyVault();
        expect(vault.hasVault()).toBe(false);
        expect(vault.isEnabled()).toBe(false);
        expect(localStorage.getItem("topos.ai_vault")).toBeNull();
    });

    it("refuses to create a second vault over an existing one", async () => {
        await vault.createVault(PASS);
        vault.lock();
        await expect(vault.createVault("another")).rejects.toThrow();
    });
});

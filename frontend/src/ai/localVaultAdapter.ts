/**
 * Local-mode ``AiKeyStoreAdapter`` over the passphrase-encrypted vault
 * (``localVaultStore``). Used by the ai-key-vault-react settings UI in the
 * no-backend PWA mode.
 *
 * Keys ARE client-readable here (``clientReadableKeys: true``), so the
 * encrypted key-vault export is available. Reads/writes require an unlocked
 * session; when the vault is locked the snapshot is built from the plaintext,
 * secret-free metadata (has-key flags + settings) so the surrounding UI can
 * still gate correctly. The live test probes the provider straight from the
 * browser via ``testAiConnectionDirect`` (only Anthropic is reachable; the
 * corsBlocked providers fail honestly with a network error).
 */

import {
    maskSecret,
    type AiKeyStoreAdapter,
    type AiKeyStoreCapabilities,
    type AiSettingsSnapshot,
    type ApiKeyTestKind,
    type ApiKeyTestResult,
    type KeySource,
} from "@astrapi69/ai-key-vault";

import {testAiConnectionDirect} from "./browserAiClient";
import {TOPOS_REGISTRY, type ToposProviderId} from "./registry";
import * as vault from "./localVaultStore";

type Snapshot = AiSettingsSnapshot<ToposProviderId>;

const IDS = TOPOS_REGISTRY.ids;

function toTestKind(ok: boolean, errorCode: string | null): ApiKeyTestKind {
    if (ok) return "ok";
    switch (errorCode) {
        case "auth_error":
            return "invalid";
        case "missing_key":
            return "no_key";
        case "network_error":
            return "network";
        default:
            return "error";
    }
}

/** Build the snapshot from the unlocked session (keys readable). */
function unlockedSnapshot(): Snapshot {
    const settings = vault.getSettings();
    const keys = vault.getKeys();
    const hasKey = {} as Record<ToposProviderId, boolean>;
    const keySource = {} as Record<ToposProviderId, KeySource>;
    const keyPreview: Partial<Record<ToposProviderId, string | null>> = {};
    const modelOverride: Partial<Record<ToposProviderId, string | null>> = {};
    const baseUrlOverride: Partial<Record<ToposProviderId, string | null>> = {};

    for (const id of IDS) {
        const key = keys[id];
        hasKey[id] = Boolean(key);
        keySource[id] = key ? "settings" : "none";
        keyPreview[id] = key ? maskSecret(key) : null;
        modelOverride[id] = settings.models[id] ?? null;
        baseUrlOverride[id] = settings.baseUrls[id] ?? null;
    }
    return {
        activeProvider: settings.activeProvider,
        hasKey,
        keySource,
        keyPreview,
        modelOverride,
        baseUrlOverride,
    };
}

/** Build the snapshot from plaintext metadata (vault locked / absent). */
function lockedSnapshot(): Snapshot {
    const meta = vault.getMeta();
    const hasKey = {} as Record<ToposProviderId, boolean>;
    const keySource = {} as Record<ToposProviderId, KeySource>;
    const modelOverride: Partial<Record<ToposProviderId, string | null>> = {};
    const baseUrlOverride: Partial<Record<ToposProviderId, string | null>> = {};

    for (const id of IDS) {
        const present = meta.hasKey[id] === true;
        hasKey[id] = present;
        keySource[id] = present ? "settings" : "none";
        modelOverride[id] = meta.models[id] ?? null;
        baseUrlOverride[id] = meta.baseUrls[id] ?? null;
    }
    return {
        activeProvider: meta.activeProvider,
        hasKey,
        keySource,
        keyPreview: {}, // locked: nothing to preview
        modelOverride,
        baseUrlOverride,
    };
}

/** Adapter backed by the passphrase-encrypted local vault. */
export function createLocalVaultAdapter(): AiKeyStoreAdapter<ToposProviderId> {
    const capabilities: AiKeyStoreCapabilities = {
        clientReadableKeys: true,
        keyBackup: false,
        liveTest: true,
    };

    function snapshot(): Snapshot {
        return vault.isUnlocked() ? unlockedSnapshot() : lockedSnapshot();
    }

    return {
        capabilities,
        async getSettings() {
            return snapshot();
        },

        async patchSettings(_userId, patch) {
            await vault.patchSettings({
                activeProvider: patch.activeProvider ?? undefined,
                models: patch.modelOverride,
                baseUrls: patch.baseUrlOverride,
            });
            return snapshot();
        },

        async setApiKey(_userId, provider, key) {
            await vault.setKey(provider, key);
            return snapshot();
        },

        async deleteApiKey(_userId, provider) {
            await vault.deleteKey(provider);
            return snapshot();
        },

        async exportApiKeys() {
            return vault.getKeys();
        },

        async testApiKey(_userId, provider, draftKey) {
            const stored = vault.isUnlocked() ? vault.getKeys()[provider] : undefined;
            const descriptor = TOPOS_REGISTRY.find(provider);
            const baseUrl =
                vault.isUnlocked() && vault.getSettings().baseUrls[provider]
                    ? vault.getSettings().baseUrls[provider]
                    : descriptor?.baseUrl;
            const result = await testAiConnectionDirect({
                provider,
                apiKey: draftKey?.trim() || stored,
                baseUrl,
            });
            return {
                success: result.ok,
                kind: toTestKind(result.ok, result.errorCode),
            } satisfies ApiKeyTestResult;
        },
    };
}

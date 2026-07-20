/**
 * Backend-mode ``AiKeyStoreAdapter`` — the storage seam of
 * ``@astrapi69/ai-key-vault`` mapped onto Topos's ``/api/settings/*`` chain.
 *
 * Keys live server-side (env var < ``secrets.yaml`` < ``app.yaml`` overlay),
 * exactly as before: they are write-only from the client and never round-trip
 * back, so ``capabilities.clientReadableKeys`` is false (the encrypted
 * key-vault export is disabled in this mode — ``secrets.yaml`` is the backup).
 * Presence and source come from ``GET /settings/ai/key-status``; the live
 * "test connection" probe stays server-side via ``POST /settings/ai/test``.
 *
 * The backend ``PATCH /settings/app`` deep-merges the ``ai`` block and strips
 * externally-managed keys defensively, so partial patches are safe and the
 * ``enabled`` flag (owned by the Topos wrapper, not the kit) is preserved.
 */

import {
    api,
    type AiConfig,
    type AiKeySource,
    type AiKeyStatus,
} from "../api/client";
import type {
    AiKeyStoreAdapter,
    AiKeyStoreCapabilities,
    AiSettingsSnapshot,
    ApiKeyTestResult,
    ApiKeyTestKind,
    KeySource,
} from "@astrapi69/ai-key-vault";

import {TOPOS_REGISTRY, type ToposProviderId} from "./registry";

type Snapshot = AiSettingsSnapshot<ToposProviderId>;

const IDS = TOPOS_REGISTRY.ids;

/** Map the backend key-source label onto the kit's ``KeySource`` union. */
function toKeySource(source: AiKeySource): KeySource {
    switch (source) {
        case "env":
            return "env";
        case "secrets_yaml":
            return "secrets_file";
        case "app_yaml":
            return "settings";
        default:
            return "none";
    }
}

/** Map a backend test error code onto the kit's test-result classification. */
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

function emptyByProvider<T>(value: T): Record<ToposProviderId, T> {
    return Object.fromEntries(IDS.map((id) => [id, value])) as Record<
        ToposProviderId,
        T
    >;
}

function buildSnapshot(
    ai: AiConfig,
    statuses: AiKeyStatus[],
): Snapshot {
    const statusById = new Map(statuses.map((s) => [s.provider, s]));
    const hasKey = emptyByProvider(false);
    const keySource = emptyByProvider<KeySource>("none");
    const modelOverride: Partial<Record<ToposProviderId, string | null>> = {};
    const baseUrlOverride: Partial<Record<ToposProviderId, string | null>> = {};

    for (const id of IDS) {
        const status = statusById.get(id);
        hasKey[id] = status?.configured ?? false;
        keySource[id] = status ? toKeySource(status.source) : "none";
        modelOverride[id] = ai.models?.[id] ?? null;
        baseUrlOverride[id] = ai.baseUrls?.[id] ?? null;
    }

    const active = ai.activeProvider;
    return {
        activeProvider:
            active && TOPOS_REGISTRY.has(active) ? (active as ToposProviderId) : null,
        hasKey,
        keySource,
        keyPreview: {}, // server never returns key material
        modelOverride,
        baseUrlOverride,
    };
}

/** Adapter over the backend config chain. Keys stay server-side. */
export function createBackendAdapter(): AiKeyStoreAdapter<ToposProviderId> {
    const capabilities: AiKeyStoreCapabilities = {
        clientReadableKeys: false,
        keyBackup: false,
        liveTest: true,
    };

    async function readSettings(): Promise<Snapshot> {
        const [appConfig, statuses] = await Promise.all([
            api.settings.getApp(),
            api.settings.getAiKeyStatus(),
        ]);
        return buildSnapshot(appConfig.ai ?? {}, statuses);
    }

    return {
        capabilities,
        getSettings: () => readSettings(),

        async patchSettings(_userId, patch) {
            const ai: AiConfig = {};
            if (patch.activeProvider !== undefined) {
                ai.activeProvider = patch.activeProvider ?? undefined;
            }
            if (patch.modelOverride) {
                ai.models = Object.fromEntries(
                    Object.entries(patch.modelOverride).map(([id, value]) => [
                        id,
                        value ?? "", // "" clears the override (empty is not an override)
                    ]),
                );
            }
            if (patch.baseUrlOverride) {
                ai.baseUrls = Object.fromEntries(
                    Object.entries(patch.baseUrlOverride).map(([id, value]) => [
                        id,
                        value ?? "",
                    ]),
                );
            }
            await api.settings.updateApp({ai});
            return readSettings();
        },

        async setApiKey(_userId, provider, key) {
            await api.settings.updateApp({ai: {keys: {[provider]: key}}});
            return readSettings();
        },

        async deleteApiKey(_userId, provider) {
            // No dedicated delete endpoint: an empty app-overlay value clears
            // the key. Externally-managed keys are stripped by the backend and
            // stay untouched.
            await api.settings.updateApp({ai: {keys: {[provider]: ""}}});
            return readSettings();
        },

        async exportApiKeys() {
            // Keys are not client-readable in backend mode.
            return {};
        },

        async testApiKey(_userId, provider, draftKey) {
            const result = await api.settings.testAiConnection({
                provider,
                apiKey: draftKey?.trim() || undefined,
            });
            const kind = toTestKind(result.ok, result.errorCode);
            return {success: result.ok, kind} satisfies ApiKeyTestResult;
        },
    };
}

/**
 * Browser-local AI configuration for the no-backend mode.
 *
 * When no backend answers (GitHub Pages PWA, Dexie-only mode) the AI
 * settings live entirely in this browser: provider choice, model
 * overrides, base URLs and API keys are persisted in localStorage,
 * following the adaptive-learner pattern where the Dexie deployment
 * stores keys client-side. With a reachable backend this store is NOT
 * used - the backend config chain stays the source of truth there.
 *
 * The stored keys never leave the device except inside the direct
 * provider requests (see ``browserAiClient``).
 */

import {getProviderPreset} from "./providerPresets";

const STORAGE_KEY = "topos.ai_config";

/** The locally persisted AI configuration (all fields always present). */
export interface LocalAiConfig {
    enabled: boolean;
    activeProvider: string;
    models: Record<string, string>;
    baseUrls: Record<string, string>;
    keys: Record<string, string>;
}

/** Provider call parameters resolved from the local config. */
export interface ResolvedLocalProvider {
    providerId: string;
    apiKey: string;
    baseUrl: string;
    model: string;
}

function emptyConfig(): LocalAiConfig {
    return {
        enabled: false,
        activeProvider: "anthropic",
        models: {},
        baseUrls: {},
        keys: {},
    };
}

function asStringRecord(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null) return {};
    const record: Record<string, string> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        if (typeof entryValue === "string") record[entryKey] = entryValue;
    }
    return record;
}

/** Read the persisted config; malformed or missing data yields defaults. */
export function getLocalAiConfig(): LocalAiConfig {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return emptyConfig();
    }
    if (!raw) return emptyConfig();
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return emptyConfig();
        const record = parsed as Record<string, unknown>;
        return {
            enabled: record.enabled === true,
            activeProvider:
                typeof record.activeProvider === "string" && record.activeProvider
                    ? record.activeProvider
                    : "anthropic",
            models: asStringRecord(record.models),
            baseUrls: asStringRecord(record.baseUrls),
            keys: asStringRecord(record.keys),
        };
    } catch {
        return emptyConfig();
    }
}

/** Persist the config. Silent no-op when localStorage is unavailable. */
export function setLocalAiConfig(config: LocalAiConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        /* localStorage unavailable (private mode); ignore. */
    }
}

/**
 * Resolve the active provider's call parameters, mirroring the backend
 * ``_resolve_provider_config`` chain (stored value, else preset default).
 * Returns ``null`` when the config is not usable (disabled, unknown
 * provider, missing key / base URL / model).
 */
export function resolveLocalAiProvider(
    config: LocalAiConfig = getLocalAiConfig(),
): ResolvedLocalProvider | null {
    if (!config.enabled) return null;
    const preset = getProviderPreset(config.activeProvider);
    if (!preset) return null;

    const apiKey = (config.keys[preset.id] ?? "").trim();
    if (preset.requiresApiKey && !apiKey) return null;

    const baseUrl = (config.baseUrls[preset.id] ?? "").trim() || preset.baseUrl;
    if (!baseUrl) return null;

    const model = (config.models[preset.id] ?? "").trim() || preset.defaultModel;
    if (!model) return null;

    return {providerId: preset.id, apiKey, baseUrl, model};
}

/** True when the local config is complete enough for a direct AI call. */
export function isLocalAiConfigured(): boolean {
    return resolveLocalAiProvider() !== null;
}

/**
 * Browser-local AI key store for the no-backend (Dexie-only PWA) mode, with
 * the API keys encrypted at rest.
 *
 * Topos never keeps AI keys as plaintext in localStorage. Instead the keys +
 * provider settings live inside a passphrase-encrypted vault envelope
 * (PBKDF2-HMAC-SHA-256 + AES-GCM-256 via ``@astrapi69/passphrase-vault``).
 * Reading a key requires an in-memory unlock session: the user enters the
 * passphrase once, the envelope is decrypted into memory, and the plaintext
 * keys never touch persistent storage.
 *
 * Two localStorage entries:
 *  - ``topos.ai_vault``      — the encrypted envelope (the only place keys
 *                              are persisted, and only in ciphertext).
 *  - ``topos.ai_vault_meta`` — plaintext, secret-free metadata (enabled flag,
 *                              active provider, model/base-URL overrides, and
 *                              a per-provider *has-key* boolean). This lets
 *                              the locked settings UI and the photo-intake
 *                              gate reflect state without a passphrase.
 *
 * The same envelope format string is used for the at-rest vault and the
 * exportable ``.alk`` key vault, so a vault exported on one device imports on
 * another. Foreign files (a different app's format) are rejected on decrypt.
 */

import {
    encryptToVault,
    decryptFromVault,
    looksLikeVaultEnvelope,
} from "@astrapi69/passphrase-vault";

import {TOPOS_REGISTRY, type ToposProviderId} from "./registry";

/** Envelope format string identifying a Topos AI key vault. */
export const TOPOS_VAULT_FORMAT = "topos-ai-keys";

const VAULT_KEY = "topos.ai_vault";
const META_KEY = "topos.ai_vault_meta";
const DEFAULT_PROVIDER: ToposProviderId = "anthropic";

/** Provider settings carried inside the encrypted payload. */
export interface VaultSettings {
    activeProvider: ToposProviderId;
    models: Partial<Record<ToposProviderId, string>>;
    baseUrls: Partial<Record<ToposProviderId, string>>;
}

/** The decrypted vault payload (keys + settings). */
interface VaultPayload {
    keys: Partial<Record<ToposProviderId, string>>;
    settings: VaultSettings;
}

/** Plaintext, secret-free mirror for the locked UI and the intake gate. */
export interface VaultMeta {
    enabled: boolean;
    activeProvider: ToposProviderId;
    models: Partial<Record<ToposProviderId, string>>;
    baseUrls: Partial<Record<ToposProviderId, string>>;
    hasKey: Partial<Record<ToposProviderId, boolean>>;
}

// --- in-memory unlock session (never persisted) ---

let sessionPassphrase: string | null = null;
let sessionKeys: Partial<Record<ToposProviderId, string>> | null = null;
let sessionSettings: VaultSettings | null = null;

function readRaw(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeRaw(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* localStorage unavailable (private mode); ignore. */
    }
}

function removeRaw(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

function defaultSettings(): VaultSettings {
    return {activeProvider: DEFAULT_PROVIDER, models: {}, baseUrls: {}};
}

function knownProvider(value: unknown): ToposProviderId {
    return typeof value === "string" && TOPOS_REGISTRY.has(value)
        ? (value as ToposProviderId)
        : DEFAULT_PROVIDER;
}

function pickStringMap(value: unknown): Partial<Record<ToposProviderId, string>> {
    const out: Partial<Record<ToposProviderId, string>> = {};
    if (typeof value !== "object" || value === null) return out;
    for (const [id, entry] of Object.entries(value)) {
        if (TOPOS_REGISTRY.has(id) && typeof entry === "string" && entry) {
            out[id as ToposProviderId] = entry;
        }
    }
    return out;
}

/** Normalise a decrypted object into a {@link VaultPayload}. */
function normalizePayload(value: unknown): VaultPayload {
    const record = (value ?? {}) as Record<string, unknown>;
    const settings = (record.settings ?? {}) as Record<string, unknown>;
    return {
        keys: pickStringMap(record.keys),
        settings: {
            activeProvider: knownProvider(settings.activeProvider),
            models: pickStringMap(settings.models),
            baseUrls: pickStringMap(settings.baseUrls),
        },
    };
}

// --- metadata (plaintext, secret-free) ---

function emptyMeta(): VaultMeta {
    return {
        enabled: false,
        activeProvider: DEFAULT_PROVIDER,
        models: {},
        baseUrls: {},
        hasKey: {},
    };
}

/** Read the plaintext metadata; missing / malformed data yields defaults. */
export function getMeta(): VaultMeta {
    const raw = readRaw(META_KEY);
    if (!raw) return emptyMeta();
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const hasKey: Partial<Record<ToposProviderId, boolean>> = {};
        const rawHasKey = (parsed.hasKey ?? {}) as Record<string, unknown>;
        for (const [id, flag] of Object.entries(rawHasKey)) {
            if (TOPOS_REGISTRY.has(id)) hasKey[id as ToposProviderId] = flag === true;
        }
        return {
            enabled: parsed.enabled === true,
            activeProvider: knownProvider(parsed.activeProvider),
            models: pickStringMap(parsed.models),
            baseUrls: pickStringMap(parsed.baseUrls),
            hasKey,
        };
    } catch {
        return emptyMeta();
    }
}

function writeMeta(meta: VaultMeta): void {
    writeRaw(META_KEY, JSON.stringify(meta));
}

/** Update the plaintext ``enabled`` flag (non-secret; no unlock required). */
export function setEnabled(enabled: boolean): void {
    writeMeta({...getMeta(), enabled});
}

/** Whether AI features are enabled in local mode. */
export function isEnabled(): boolean {
    return getMeta().enabled;
}

/** Sync the plaintext metadata from the current (unlocked) session. */
function syncMeta(): void {
    if (!sessionKeys || !sessionSettings) return;
    const hasKey: Partial<Record<ToposProviderId, boolean>> = {};
    for (const id of TOPOS_REGISTRY.ids) {
        hasKey[id] = Boolean((sessionKeys[id] ?? "").trim());
    }
    writeMeta({
        enabled: getMeta().enabled,
        activeProvider: sessionSettings.activeProvider,
        models: {...sessionSettings.models},
        baseUrls: {...sessionSettings.baseUrls},
        hasKey,
    });
}

// --- vault lifecycle ---

/** True when an encrypted vault envelope is persisted. */
export function hasVault(): boolean {
    const raw = readRaw(VAULT_KEY);
    return Boolean(raw && looksLikeVaultEnvelope(raw, {format: TOPOS_VAULT_FORMAT}));
}

/** True when the vault is unlocked in this session (keys are in memory). */
export function isUnlocked(): boolean {
    return sessionPassphrase !== null && sessionKeys !== null;
}

async function persist(): Promise<void> {
    if (sessionPassphrase === null || !sessionKeys || !sessionSettings) {
        throw new Error("Vault is locked");
    }
    const payload: VaultPayload = {keys: sessionKeys, settings: sessionSettings};
    const envelope = await encryptToVault(payload, sessionPassphrase, {
        format: TOPOS_VAULT_FORMAT,
    });
    writeRaw(VAULT_KEY, envelope);
    syncMeta();
}

/**
 * Create a fresh, empty vault protected by ``passphrase`` and open the
 * session. Rejects when a vault already exists (unlock it instead).
 */
export async function createVault(passphrase: string): Promise<void> {
    if (!passphrase) throw new Error("Passphrase must not be empty");
    if (hasVault()) throw new Error("A vault already exists");
    sessionPassphrase = passphrase;
    sessionKeys = {};
    sessionSettings = defaultSettings();
    await persist();
}

/**
 * Decrypt the persisted vault with ``passphrase`` and open the session.
 * Propagates ``VaultDecryptError`` on a wrong passphrase / corrupt / foreign
 * envelope, leaving the session locked.
 */
export async function unlock(passphrase: string): Promise<void> {
    const raw = readRaw(VAULT_KEY);
    if (!raw) throw new Error("No vault to unlock");
    const value = await decryptFromVault(raw, passphrase, {
        format: TOPOS_VAULT_FORMAT,
    });
    const payload = normalizePayload(value);
    sessionPassphrase = passphrase;
    sessionKeys = payload.keys;
    sessionSettings = payload.settings;
    syncMeta();
}

/** Clear the in-memory session (keys + passphrase). Metadata is retained. */
export function lock(): void {
    sessionPassphrase = null;
    sessionKeys = null;
    sessionSettings = null;
}

/**
 * Delete the vault entirely: the encrypted envelope, the metadata and the
 * open session. Used by "forgot passphrase" recovery (keys are unrecoverable
 * by design, so the only path forward is to start over).
 */
export function destroyVault(): void {
    lock();
    removeRaw(VAULT_KEY);
    removeRaw(META_KEY);
}

// --- session accessors (require unlock) ---

function requireSession(): {
    keys: Partial<Record<ToposProviderId, string>>;
    settings: VaultSettings;
} {
    if (!sessionKeys || !sessionSettings) throw new Error("Vault is locked");
    return {keys: sessionKeys, settings: sessionSettings};
}

/** Current provider settings (unlocked session). */
export function getSettings(): VaultSettings {
    return {...requireSession().settings};
}

/** All present keys (unlocked session) — for the encrypted key export. */
export function getKeys(): Partial<Record<ToposProviderId, string>> {
    const {keys} = requireSession();
    const out: Partial<Record<ToposProviderId, string>> = {};
    for (const id of TOPOS_REGISTRY.ids) {
        const value = (keys[id] ?? "").trim();
        if (value) out[id] = value;
    }
    return out;
}

/** Store (or overwrite) a provider key. */
export async function setKey(provider: ToposProviderId, key: string): Promise<void> {
    const {keys} = requireSession();
    keys[provider] = key.trim();
    await persist();
}

/** Remove a provider key. */
export async function deleteKey(provider: ToposProviderId): Promise<void> {
    const {keys} = requireSession();
    delete keys[provider];
    await persist();
}

/** Patch provider settings (active provider, model / base-URL overrides). */
export async function patchSettings(patch: {
    activeProvider?: ToposProviderId | null;
    models?: Partial<Record<ToposProviderId, string | null>>;
    baseUrls?: Partial<Record<ToposProviderId, string | null>>;
}): Promise<void> {
    const {settings} = requireSession();
    if (patch.activeProvider) settings.activeProvider = patch.activeProvider;
    for (const [id, value] of Object.entries(patch.models ?? {})) {
        if (!TOPOS_REGISTRY.has(id)) continue;
        if (value) settings.models[id as ToposProviderId] = value;
        else delete settings.models[id as ToposProviderId];
    }
    for (const [id, value] of Object.entries(patch.baseUrls ?? {})) {
        if (!TOPOS_REGISTRY.has(id)) continue;
        if (value) settings.baseUrls[id as ToposProviderId] = value;
        else delete settings.baseUrls[id as ToposProviderId];
    }
    await persist();
}

/** Resolved call parameters for the active provider, or ``null`` when the
 *  vault is locked / disabled / the active provider has no usable key. */
export interface ResolvedLocalProvider {
    providerId: ToposProviderId;
    apiKey: string;
    baseUrl: string;
    model: string;
}

/**
 * Resolve the active provider's call parameters from the unlocked session,
 * mirroring the backend resolve chain (stored value, else descriptor
 * default). Returns ``null`` when locked, disabled, or incomplete.
 */
export function resolveActiveProvider(): ResolvedLocalProvider | null {
    if (!isEnabled() || !isUnlocked() || !sessionKeys || !sessionSettings) return null;
    const descriptor = TOPOS_REGISTRY.find(sessionSettings.activeProvider);
    if (!descriptor) return null;

    const apiKey = (sessionKeys[descriptor.id as ToposProviderId] ?? "").trim();
    if (descriptor.requiresApiKey !== false && !apiKey) return null;

    const baseUrl =
        (sessionSettings.baseUrls[descriptor.id as ToposProviderId] ?? "").trim() ||
        descriptor.baseUrl ||
        "";
    if (!baseUrl) return null;

    const model =
        (sessionSettings.models[descriptor.id as ToposProviderId] ?? "").trim() ||
        descriptor.defaultModel;
    if (!model) return null;

    return {providerId: descriptor.id as ToposProviderId, apiKey, baseUrl, model};
}

/** TEST ONLY: reset the in-memory session without touching storage. */
export function _resetSessionForTest(): void {
    lock();
}

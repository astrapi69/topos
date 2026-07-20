/**
 * Browser-local AI module: the provider registry, the passphrase-encrypted
 * key vault and the browser-direct provider calls for the no-backend
 * (Dexie-only PWA) mode.
 */

export {
    TOPOS_PROVIDERS,
    TOPOS_REGISTRY,
    supportsBrowserDirect,
    type ToposProviderId,
} from "./registry";
export {
    getMeta,
    hasVault,
    isEnabled,
    isUnlocked,
    resolveActiveProvider,
    type ResolvedLocalProvider,
    type VaultMeta,
    type VaultSettings,
} from "./localVaultStore";
export {
    recognizePhotoDirect,
    testAiConnectionDirect,
    type DirectRecognizeOptions,
} from "./browserAiClient";

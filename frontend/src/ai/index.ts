/**
 * Browser-local AI module: provider presets, localStorage config and
 * browser-direct provider calls for the no-backend (Dexie-only) mode.
 */

export {AI_PROVIDER_PRESETS, getProviderPreset, supportsBrowserDirect} from "./providerPresets";
export {
    getLocalAiConfig,
    isLocalAiConfigured,
    resolveLocalAiProvider,
    setLocalAiConfig,
    type LocalAiConfig,
    type ResolvedLocalProvider,
} from "./localAiConfig";
export {
    recognizePhotoDirect,
    testAiConnectionDirect,
    type DirectRecognizeOptions,
} from "./browserAiClient";

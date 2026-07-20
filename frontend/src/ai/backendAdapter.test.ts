import {beforeEach, describe, expect, it, vi} from "vitest";

import {createBackendAdapter} from "./backendAdapter";

const mockGetApp = vi.fn();
const mockGetKeyStatus = vi.fn();
const mockUpdateApp = vi.fn();
const mockTest = vi.fn();
const mockDeleteAiKey = vi.fn();

vi.mock("../api/client", () => ({
    api: {
        settings: {
            getApp: () => mockGetApp(),
            getAiKeyStatus: () => mockGetKeyStatus(),
            updateApp: (patch: unknown) => mockUpdateApp(patch),
            testAiConnection: (body: unknown) => mockTest(body),
            deleteAiKey: (provider: string) => mockDeleteAiKey(provider),
        },
    },
}));

const USER = "topos";

beforeEach(() => {
    vi.clearAllMocks();
    mockGetApp.mockResolvedValue({
        ai: {
            enabled: true,
            activeProvider: "openai",
            models: {anthropic: "claude-opus-4-8"},
            baseUrls: {custom: "http://localhost:1234/v1"},
        },
    });
    mockGetKeyStatus.mockResolvedValue([
        {provider: "anthropic", configured: true, source: "app_yaml", externallyManaged: false},
        {provider: "openai", configured: true, source: "env", externallyManaged: true},
        {provider: "google", configured: false, source: "none", externallyManaged: false},
        {provider: "custom", configured: false, source: "none", externallyManaged: false},
    ]);
    mockUpdateApp.mockResolvedValue({});
    mockTest.mockResolvedValue({ok: true, errorCode: null});
    mockDeleteAiKey.mockResolvedValue({provider: "anthropic", configured: false, source: "none"});
});

describe("backendAdapter", () => {
    it("maps the config chain onto a settings snapshot", async () => {
        const adapter = createBackendAdapter();
        const snap = await adapter.getSettings(USER);
        expect(snap.activeProvider).toBe("openai");
        expect(snap.hasKey.anthropic).toBe(true);
        expect(snap.keySource.anthropic).toBe("settings"); // app_yaml -> settings
        expect(snap.keySource.openai).toBe("env"); // externally managed
        expect(snap.modelOverride.anthropic).toBe("claude-opus-4-8");
        expect(snap.baseUrlOverride?.custom).toBe("http://localhost:1234/v1");
        // Keys are never client-readable in backend mode.
        expect(adapter.capabilities.clientReadableKeys).toBe(false);
        expect(snap.keyPreview).toEqual({});
    });

    it("writes a key through PATCH", async () => {
        const adapter = createBackendAdapter();
        await adapter.setApiKey(USER, "anthropic", "sk-ant-new");
        expect(mockUpdateApp).toHaveBeenCalledWith({ai: {keys: {anthropic: "sk-ant-new"}}});
    });

    it("deletes a key through the dedicated endpoint", async () => {
        const adapter = createBackendAdapter();
        await adapter.deleteApiKey(USER, "anthropic");
        expect(mockDeleteAiKey).toHaveBeenCalledWith("anthropic");
        expect(mockUpdateApp).not.toHaveBeenCalled();
    });

    it("patches the custom base URL through baseUrls", async () => {
        const adapter = createBackendAdapter();
        await adapter.patchSettings(USER, {baseUrlOverride: {custom: "http://host/v1"}});
        expect(mockUpdateApp).toHaveBeenCalledWith({
            ai: {baseUrls: {custom: "http://host/v1"}},
        });
    });

    it("clears a model override with an empty string", async () => {
        const adapter = createBackendAdapter();
        await adapter.patchSettings(USER, {modelOverride: {anthropic: null}});
        expect(mockUpdateApp).toHaveBeenCalledWith({ai: {models: {anthropic: ""}}});
    });

    it("classifies a live test error code", async () => {
        mockTest.mockResolvedValue({ok: false, errorCode: "auth_error"});
        const adapter = createBackendAdapter();
        const result = await adapter.testApiKey!(USER, "openai", "bad-key");
        expect(result).toEqual({success: false, kind: "invalid"});
    });
});

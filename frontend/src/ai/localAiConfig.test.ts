import {beforeEach, describe, expect, it} from "vitest";

import {
    getLocalAiConfig,
    isLocalAiConfigured,
    resolveLocalAiProvider,
    setLocalAiConfig,
    type LocalAiConfig,
} from "./localAiConfig";

function usableConfig(overrides: Partial<LocalAiConfig> = {}): LocalAiConfig {
    return {
        enabled: true,
        activeProvider: "anthropic",
        models: {},
        baseUrls: {},
        keys: {anthropic: "sk-local"},
        ...overrides,
    };
}

beforeEach(() => {
    localStorage.clear();
});

describe("getLocalAiConfig", () => {
    it("returns defaults when nothing is stored", () => {
        expect(getLocalAiConfig()).toEqual({
            enabled: false,
            activeProvider: "anthropic",
            models: {},
            baseUrls: {},
            keys: {},
        });
    });

    it("round-trips a stored config", () => {
        const config = usableConfig({
            models: {anthropic: "claude-opus-4-8"},
            baseUrls: {custom: "http://localhost:11434/v1"},
        });
        setLocalAiConfig(config);
        expect(getLocalAiConfig()).toEqual(config);
    });

    it("falls back to defaults on malformed JSON", () => {
        localStorage.setItem("topos.ai_config", "{not json");
        expect(getLocalAiConfig().enabled).toBe(false);
    });

    it("drops non-string entries from the record fields", () => {
        localStorage.setItem(
            "topos.ai_config",
            JSON.stringify({enabled: true, keys: {anthropic: 42, openai: "sk-ok"}}),
        );
        expect(getLocalAiConfig().keys).toEqual({openai: "sk-ok"});
    });
});

describe("resolveLocalAiProvider", () => {
    it("resolves key, preset base URL and default model", () => {
        expect(resolveLocalAiProvider(usableConfig())).toEqual({
            providerId: "anthropic",
            apiKey: "sk-local",
            baseUrl: "https://api.anthropic.com/v1",
            model: "claude-sonnet-4-6",
        });
    });

    it("prefers stored model and base URL over the preset", () => {
        const resolved = resolveLocalAiProvider(
            usableConfig({
                models: {anthropic: "claude-opus-4-8"},
                baseUrls: {anthropic: "https://proxy.example/v1"},
            }),
        );
        expect(resolved).toEqual({
            providerId: "anthropic",
            apiKey: "sk-local",
            baseUrl: "https://proxy.example/v1",
            model: "claude-opus-4-8",
        });
    });

    it("returns null when disabled", () => {
        expect(resolveLocalAiProvider(usableConfig({enabled: false}))).toBeNull();
    });

    it("returns null without an API key", () => {
        expect(resolveLocalAiProvider(usableConfig({keys: {}}))).toBeNull();
    });

    it("returns null for an unknown provider", () => {
        expect(
            resolveLocalAiProvider(usableConfig({activeProvider: "nope"})),
        ).toBeNull();
    });

    it("requires base URL and model for the custom provider", () => {
        const base = usableConfig({activeProvider: "custom", keys: {custom: "k"}});
        expect(resolveLocalAiProvider(base)).toBeNull();
        expect(
            resolveLocalAiProvider({
                ...base,
                baseUrls: {custom: "http://localhost:11434/v1"},
            }),
        ).toBeNull();
        expect(
            resolveLocalAiProvider({
                ...base,
                baseUrls: {custom: "http://localhost:11434/v1"},
                models: {custom: "llava"},
            }),
        ).toEqual({
            providerId: "custom",
            apiKey: "k",
            baseUrl: "http://localhost:11434/v1",
            model: "llava",
        });
    });
});

describe("isLocalAiConfigured", () => {
    it("reflects whether the persisted config is usable", () => {
        expect(isLocalAiConfigured()).toBe(false);
        setLocalAiConfig(usableConfig());
        expect(isLocalAiConfigured()).toBe(true);
    });
});

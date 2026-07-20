import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError} from "../api/client";
import {
    blobToBase64,
    googleResponseSchema,
    recognizePhotoDirect,
    testAiConnectionDirect,
} from "./browserAiClient";
import type {ResolvedLocalProvider} from "./localVaultStore";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
    return {
        status,
        ok: status < 400,
        json: async () => body,
    } as unknown as Response;
}

function resolved(overrides: Partial<ResolvedLocalProvider> = {}): ResolvedLocalProvider {
    return {
        providerId: "anthropic",
        apiKey: "sk-local",
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-6",
        ...overrides,
    };
}

const RECOGNIZE_OPTIONS = {
    photo: new Blob(["jpeg-bytes"], {type: "image/jpeg"}),
    mediaType: "image/jpeg",
    containerType: "box",
    categories: ["tools", "finance/bank"],
};

const ITEM = {
    label: "Bohrmaschine",
    category_path: "tools",
    new_category_hint: "",
    description: "Akku-Bohrmaschine",
    confidence: 0.9,
};

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
});

describe("blobToBase64", () => {
    it("encodes blob bytes as base64", async () => {
        expect(await blobToBase64(new Blob(["abc"]))).toBe(btoa("abc"));
    });
});

describe("googleResponseSchema", () => {
    it("uppercases types and drops additionalProperties and bounds", () => {
        const schema = googleResponseSchema();
        expect(schema.type).toBe("OBJECT");
        expect(schema).not.toHaveProperty("additionalProperties");
        const items = (schema.properties as Record<string, Record<string, unknown>>).items;
        expect(items.type).toBe("ARRAY");
        const entry = items.items as Record<string, unknown>;
        const confidence = (entry.properties as Record<string, Record<string, unknown>>)
            .confidence;
        expect(confidence).toEqual({type: "NUMBER"});
    });
});

describe("testAiConnectionDirect", () => {
    it("returns unknown_provider without any network call", async () => {
        expect(await testAiConnectionDirect({provider: "nope"})).toEqual({
            ok: false,
            errorCode: "unknown_provider",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns missing_key when the provider requires one", async () => {
        expect(await testAiConnectionDirect({provider: "anthropic"})).toEqual({
            ok: false,
            errorCode: "missing_key",
        });
    });

    it("probes the anthropic models endpoint with browser-access headers", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, {}));
        const result = await testAiConnectionDirect({
            provider: "anthropic",
            apiKey: "sk-a",
        });
        expect(result).toEqual({ok: true, errorCode: null});
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.anthropic.com/v1/models");
        expect(init.headers).toMatchObject({
            "x-api-key": "sk-a",
            "anthropic-dangerous-direct-browser-access": "true",
        });
    });

    it("passes the gemini key as a query parameter", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, {}));
        await testAiConnectionDirect({provider: "google", apiKey: "g-key"});
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models?key=g-key",
        );
    });

    it("maps 401 to auth_error and 500 to provider_error", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
        expect(
            (await testAiConnectionDirect({provider: "openai", apiKey: "k"})).errorCode,
        ).toBe("auth_error");
        fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
        expect(
            (await testAiConnectionDirect({provider: "openai", apiKey: "k"})).errorCode,
        ).toBe("provider_error");
    });

    it("maps transport failure to network_error", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        expect(
            (await testAiConnectionDirect({provider: "openai", apiKey: "k"})).errorCode,
        ).toBe("network_error");
    });
});

describe("recognizePhotoDirect", () => {
    it("calls anthropic with forced tool use and parses the tool input", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {
                content: [{type: "tool_use", input: {items: [ITEM]}}],
            }),
        );
        const result = await recognizePhotoDirect(resolved(), RECOGNIZE_OPTIONS);
        expect(result.provider).toBe("anthropic");
        expect(result.model).toBe("claude-sonnet-4-6");
        expect(result.items[0].label).toBe("Bohrmaschine");

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(init.headers).toMatchObject({
            "x-api-key": "sk-local",
            "anthropic-dangerous-direct-browser-access": "true",
        });
        const payload = JSON.parse(String(init.body));
        expect(payload.tool_choice).toEqual({type: "tool", name: "report_items"});
        expect(payload.messages[0].content[0].source.data).toBe(btoa("jpeg-bytes"));
        expect(payload.messages[0].content[1].text).toContain("finance/bank, tools");
        expect(payload.messages[0].content[1].text).toContain("cataloguing");
    });

    it("retries openai-compatible servers once without response_format on 400", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(400, {error: {message: "no json_schema"}}))
            .mockResolvedValueOnce(
                jsonResponse(200, {
                    choices: [{message: {content: JSON.stringify({items: [ITEM]})}}],
                }),
            );
        const result = await recognizePhotoDirect(
            resolved({providerId: "openai", baseUrl: "http://localhost:11434/v1", model: "llava"}),
            RECOGNIZE_OPTIONS,
        );
        expect(result.items).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const first = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
        const second = JSON.parse(
            String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
        );
        expect(first.response_format?.type).toBe("json_schema");
        expect(second.response_format).toBeUndefined();
    });

    it("calls gemini with the response schema and the key as query param", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {
                candidates: [
                    {content: {parts: [{text: JSON.stringify({items: [ITEM]})}]}},
                ],
            }),
        );
        const result = await recognizePhotoDirect(
            resolved({
                providerId: "google",
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                model: "gemini-2.0-flash",
            }),
            RECOGNIZE_OPTIONS,
        );
        expect(result.items).toHaveLength(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=sk-local",
        );
        const payload = JSON.parse(String(init.body));
        expect(payload.generationConfig.responseSchema.type).toBe("OBJECT");
    });

    it("maps auth failures to an ApiError naming the key problem", async () => {
        fetchMock.mockResolvedValue(jsonResponse(401, {error: {message: "bad key"}}));
        await expect(
            recognizePhotoDirect(resolved(), RECOGNIZE_OPTIONS),
        ).rejects.toMatchObject({
            name: "ApiError",
            status: 401,
            detail: expect.stringContaining("authentication failed"),
        });
    });

    it("maps 429 to a rate-limit ApiError and transport failure to 502", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(429, {error: {message: "slow down"}}));
        await expect(
            recognizePhotoDirect(resolved(), RECOGNIZE_OPTIONS),
        ).rejects.toMatchObject({status: 429});

        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        const failure = await recognizePhotoDirect(resolved(), RECOGNIZE_OPTIONS).catch(
            (recognizeError) => recognizeError,
        );
        expect(failure).toBeInstanceOf(ApiError);
        expect(failure.status).toBe(502);
        expect(failure.detail).toContain("network error");
    });

    it("raises a 502 ApiError on an unparseable model response", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {content: [{type: "text", text: "no json here"}]}),
        );
        await expect(
            recognizePhotoDirect(resolved(), RECOGNIZE_OPTIONS),
        ).rejects.toMatchObject({
            status: 502,
            detail: expect.stringContaining("unparseable model response"),
        });
    });
});

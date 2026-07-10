/**
 * Browser-direct AI provider calls for the no-backend mode.
 *
 * Mirror of ``backend/app/ai/connection.py`` (key probe) and
 * ``backend/app/ai/vision_clients.py`` (vision recognition) - keep the
 * request shapes and error mapping in sync. With a reachable backend
 * both go through the API (``/settings/ai/test``, ``/ai/vision``);
 * these clients only serve the Dexie-only PWA, following the
 * adaptive-learner pattern of calling providers straight from the
 * user's browser.
 *
 * Cross-origin notes (same as adaptive-learner):
 * - Anthropic requires ``anthropic-dangerous-direct-browser-access:
 *   true`` - the explicit opt-in for browser callers.
 * - OpenAI: open CORS, bearer token header.
 * - Gemini: API key as ``?key=`` query parameter, open CORS.
 *
 * Structured output is enforced provider-natively exactly like the
 * backend: Anthropic forced tool use, OpenAI ``json_schema`` (with one
 * retry without ``response_format`` for local servers), Gemini
 * ``responseSchema``. Errors surface as ``ApiError`` so the existing
 * toast / issue-report chain needs no branching.
 */

import {ApiError, type AiTestResult, type VisionResult} from "../api/client";
import type {ResolvedLocalProvider} from "./localAiConfig";
import {getProviderPreset} from "./providerPresets";
import {parseItemsPayload} from "./visionParsing";
import {buildVisionPrompt, selectCategoriesForPrompt} from "./visionPrompt";

const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "report_items";
const MAX_OUTPUT_TOKENS = 2048;
const TEST_TIMEOUT_MS = 10_000;
const RECOGNIZE_TIMEOUT_MS = 60_000;

type JsonRecord = Record<string, unknown>;

/** Single source of the structured-output contract (mirror of
 *  ``ITEMS_JSON_SCHEMA`` in ``vision_schemas.py``). */
const ITEM_PROPERTIES: JsonRecord = {
    label: {type: "string", description: "Short German name of the item."},
    category_path: {
        type: "string",
        description: "Best match from the existing categories, or empty string.",
    },
    new_category_hint: {
        type: "string",
        description: "english-kebab-case proposal when no existing category fits, else empty.",
    },
    description: {type: "string", description: "Brief German description of the item."},
    confidence: {type: "number", minimum: 0, maximum: 1},
};

export const ITEMS_JSON_SCHEMA: JsonRecord = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                properties: ITEM_PROPERTIES,
                required: Object.keys(ITEM_PROPERTIES).sort(),
                additionalProperties: false,
            },
        },
    },
    required: ["items"],
    additionalProperties: false,
};

/** Gemini variant: Schema proto with uppercase types, no
 *  ``additionalProperties``, no numeric bounds (mirror of
 *  ``google_response_schema``). */
export function googleResponseSchema(node: JsonRecord = ITEMS_JSON_SCHEMA): JsonRecord {
    const converted: JsonRecord = {type: String(node.type).toUpperCase()};
    if (typeof node.description === "string") converted.description = node.description;
    if (node.type === "object") {
        const properties = node.properties as Record<string, JsonRecord>;
        converted.properties = Object.fromEntries(
            Object.entries(properties).map(([name, child]) => [
                name,
                googleResponseSchema(child),
            ]),
        );
        converted.required = [...((node.required as string[] | undefined) ?? [])];
    } else if (node.type === "array") {
        converted.items = googleResponseSchema(node.items as JsonRecord);
    }
    return converted;
}

/** Encode a Blob as base64 without blowing the call stack on large files. */
export async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        binary += String.fromCharCode(...buffer.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

interface ProviderResponse {
    status: number;
    body: JsonRecord;
}

async function postJson(
    provider: string,
    url: string,
    options: {
        headers: Record<string, string>;
        params?: Record<string, string>;
        payload: JsonRecord;
        timeoutMs: number;
    },
): Promise<ProviderResponse> {
    const target = options.params ? `${url}?${new URLSearchParams(options.params)}` : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    let response: Response;
    try {
        response = await fetch(target, {
            method: "POST",
            headers: {"Content-Type": "application/json", ...options.headers},
            body: JSON.stringify(options.payload),
            signal: controller.signal,
        });
    } catch (transportError) {
        const reason =
            controller.signal.aborted || (transportError as Error).name === "AbortError"
                ? `request timed out after ${Math.round(options.timeoutMs / 1000)}s`
                : `network error: ${(transportError as Error).message}`;
        throw new ApiError(502, `${provider}: ${reason}`, url, "POST");
    } finally {
        clearTimeout(timer);
    }
    const body = (await response.json().catch(() => ({}))) as JsonRecord;
    return {status: response.status, body};
}

function errorDetail(body: JsonRecord): string {
    const errorBlock = body.error;
    if (typeof errorBlock === "object" && errorBlock !== null) {
        const message = (errorBlock as JsonRecord).message;
        if (typeof message === "string" && message) return message;
    }
    if (typeof body.message === "string" && body.message) return body.message;
    const rendered = JSON.stringify(body) ?? "";
    return rendered && rendered !== "{}"
        ? rendered.slice(0, 300)
        : "no error detail in response";
}

function raiseForStatus(
    provider: string,
    response: ProviderResponse,
    endpoint: string,
): void {
    if (response.status < 400) return;
    const detail = errorDetail(response.body);
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(
            response.status,
            `${provider}: authentication failed (HTTP ${response.status}) - check the API key in Settings`,
            endpoint,
            "POST",
        );
    }
    if (response.status === 429) {
        throw new ApiError(
            429,
            `${provider}: rate limit exceeded, retry later (${detail})`,
            endpoint,
            "POST",
        );
    }
    throw new ApiError(502, `${provider}: HTTP ${response.status}: ${detail}`, endpoint, "POST");
}

function parseOrRaise(provider: string, outputPayload: unknown, endpoint: string) {
    try {
        return parseItemsPayload(outputPayload);
    } catch (parseError) {
        throw new ApiError(
            502,
            `${provider}: unparseable model response: ${(parseError as Error).message}`,
            endpoint,
            "POST",
        );
    }
}

// --- connection probe (mirror of connection.py) ---

/**
 * Probe a provider with the given key via its models listing - a
 * cheap, side-effect-free GET. Returns the same ``{ok, errorCode}``
 * codes as ``POST /api/settings/ai/test`` so the Settings i18n keys
 * apply unchanged. Never throws.
 */
export async function testAiConnectionDirect(options: {
    provider: string;
    apiKey?: string;
    baseUrl?: string;
}): Promise<AiTestResult> {
    const preset = getProviderPreset(options.provider);
    if (!preset) return {ok: false, errorCode: "unknown_provider"};

    const effectiveBase = (options.baseUrl || preset.baseUrl).trim().replace(/\/+$/, "");
    if (preset.requiresBaseUrl && !effectiveBase) {
        return {ok: false, errorCode: "missing_base_url"};
    }
    const apiKey = (options.apiKey ?? "").trim();
    if (preset.requiresApiKey && !apiKey) return {ok: false, errorCode: "missing_key"};

    let url = `${effectiveBase}/models`;
    const headers: Record<string, string> = {};
    if (preset.id === "anthropic") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = ANTHROPIC_VERSION;
        headers["anthropic-dangerous-direct-browser-access"] = "true";
    } else if (preset.id === "google") {
        url = `${url}?${new URLSearchParams({key: apiKey})}`;
    } else {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {headers, signal: controller.signal});
        if (response.status === 200) return {ok: true, errorCode: null};
        if (response.status === 401 || response.status === 403) {
            return {ok: false, errorCode: "auth_error"};
        }
        return {ok: false, errorCode: "provider_error"};
    } catch {
        return {ok: false, errorCode: "network_error"};
    } finally {
        clearTimeout(timer);
    }
}

// --- vision recognition (mirror of vision_clients.py) ---

export interface DirectRecognizeOptions {
    photo: Blob;
    /** Normalized image MIME type (the downscaler always emits JPEG). */
    mediaType: string;
    /** ``box`` or ``folder``; steers the prompt focus. */
    containerType: string;
    /** All existing category paths; reduced token-aware for the prompt. */
    categories: string[];
}

/**
 * Recognize the items on a container photo by calling the resolved
 * provider straight from the browser. Same result shape as
 * ``POST /api/ai/vision``.
 */
export async function recognizePhotoDirect(
    resolved: ResolvedLocalProvider,
    options: DirectRecognizeOptions,
): Promise<VisionResult> {
    const imageB64 = await blobToBase64(options.photo);
    const prompt = buildVisionPrompt(
        options.containerType,
        selectCategoriesForPrompt(options.categories),
    );
    const request = {
        ...resolved,
        imageB64,
        mediaType: options.mediaType || "image/jpeg",
        prompt,
    };
    let items;
    if (resolved.providerId === "anthropic") {
        items = await recognizeAnthropicDirect(request);
    } else if (resolved.providerId === "google") {
        items = await recognizeGoogleDirect(request);
    } else {
        // openai + custom share the OpenAI-compatible wire format.
        items = await recognizeOpenAiDirect(request);
    }
    return {provider: resolved.providerId, model: resolved.model, items};
}

interface DirectRequest extends ResolvedLocalProvider {
    imageB64: string;
    mediaType: string;
    prompt: string;
}

async function recognizeAnthropicDirect(request: DirectRequest) {
    const url = `${request.baseUrl.replace(/\/+$/, "")}/messages`;
    const response = await postJson("anthropic", url, {
        headers: {
            "x-api-key": request.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "anthropic-dangerous-direct-browser-access": "true",
        },
        payload: {
            model: request.model,
            max_tokens: MAX_OUTPUT_TOKENS,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: request.mediaType,
                                data: request.imageB64,
                            },
                        },
                        {type: "text", text: request.prompt},
                    ],
                },
            ],
            tools: [
                {
                    name: TOOL_NAME,
                    description: "Report every clearly visible item on the photo.",
                    input_schema: ITEMS_JSON_SCHEMA,
                },
            ],
            tool_choice: {type: "tool", name: TOOL_NAME},
        },
        timeoutMs: RECOGNIZE_TIMEOUT_MS,
    });
    raiseForStatus("anthropic", response, url);
    return parseOrRaise("anthropic", anthropicOutput(response.body), url);
}

function anthropicOutput(body: JsonRecord): unknown {
    const blocks = Array.isArray(body.content) ? (body.content as JsonRecord[]) : [];
    const toolUse = blocks.find((block) => block?.type === "tool_use");
    if (toolUse) return toolUse.input ?? {};
    return blocks
        .filter((block) => block?.type === "text")
        .map((block) => String(block.text ?? ""))
        .join("\n");
}

async function recognizeOpenAiDirect(request: DirectRequest) {
    const provider = request.providerId;
    const url = `${request.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const headers = {Authorization: `Bearer ${request.apiKey}`};
    let response = await postJson(provider, url, {
        headers,
        payload: openAiPayload(request, {structured: true}),
        timeoutMs: RECOGNIZE_TIMEOUT_MS,
    });
    if (response.status === 400) {
        // Local OpenAI-compatible servers may not know json_schema;
        // retry once without response_format, the parser tolerates prose.
        response = await postJson(provider, url, {
            headers,
            payload: openAiPayload(request, {structured: false}),
            timeoutMs: RECOGNIZE_TIMEOUT_MS,
        });
    }
    raiseForStatus(provider, response, url);
    return parseOrRaise(provider, openAiOutput(response.body), url);
}

function openAiPayload(request: DirectRequest, options: {structured: boolean}): JsonRecord {
    const payload: JsonRecord = {
        model: request.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${request.mediaType};base64,${request.imageB64}`,
                        },
                    },
                    {type: "text", text: request.prompt},
                ],
            },
        ],
    };
    if (options.structured) {
        payload.response_format = {
            type: "json_schema",
            json_schema: {name: TOOL_NAME, strict: true, schema: ITEMS_JSON_SCHEMA},
        };
    }
    return payload;
}

function openAiOutput(body: JsonRecord): unknown {
    const choices = Array.isArray(body.choices) ? (body.choices as JsonRecord[]) : [];
    const message = (choices[0]?.message ?? {}) as JsonRecord;
    return message.content ?? "";
}

async function recognizeGoogleDirect(request: DirectRequest) {
    const url = `${request.baseUrl.replace(/\/+$/, "")}/models/${request.model}:generateContent`;
    const response = await postJson("google", url, {
        headers: {},
        params: {key: request.apiKey},
        payload: {
            contents: [
                {
                    parts: [
                        {inlineData: {mimeType: request.mediaType, data: request.imageB64}},
                        {text: request.prompt},
                    ],
                },
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: googleResponseSchema(),
                maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
        },
        timeoutMs: RECOGNIZE_TIMEOUT_MS,
    });
    raiseForStatus("google", response, url);
    return parseOrRaise("google", googleOutput(response.body), url);
}

function googleOutput(body: JsonRecord): unknown {
    const candidates = Array.isArray(body.candidates) ? (body.candidates as JsonRecord[]) : [];
    const content = (candidates[0]?.content ?? {}) as JsonRecord;
    const parts = Array.isArray(content.parts) ? (content.parts as JsonRecord[]) : [];
    return parts
        .filter((part) => typeof part?.text === "string" && part.text)
        .map((part) => String(part.text))
        .join("\n");
}

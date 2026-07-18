/**
 * Tolerant parsing of vision-model output into ``RecognizedItem`` rows.
 *
 * Mirror of ``backend/app/ai/vision_parsing.py`` for the browser-direct
 * mode. Primary path: the provider's structured output is already an
 * object (Anthropic forced tool use) or a clean JSON string (OpenAI
 * ``json_schema``, Gemini ``responseSchema``). Fallback path: custom
 * OpenAI-compatible local servers may ignore the schema and return
 * prose-wrapped or fenced JSON; fences are stripped and the first
 * valid JSON fragment is extracted before validating. Malformed
 * individual entries are skipped so one bad row does not discard an
 * otherwise usable recognition.
 */

import type {RecognizedItem} from "../api/client";

const FENCE_OPEN_RE = /^```[a-zA-Z0-9_-]*\s*\n?/;
const FENCE_CLOSE_RE = /\n?```\s*$/;

function clampConfidence(value: unknown): number {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (typeof numeric !== "number" || Number.isNaN(numeric)) return 0;
    return Math.min(1, Math.max(0, numeric));
}

function toRecognizedItem(entry: unknown): RecognizedItem | null {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!label) return null;
    return {
        label,
        categoryPath: typeof record.category_path === "string" ? record.category_path : "",
        newCategoryHint:
            typeof record.new_category_hint === "string" ? record.new_category_hint : "",
        description: typeof record.description === "string" ? record.description : "",
        confidence: clampConfidence(record.confidence),
    };
}

/**
 * Turn a model response into validated ``RecognizedItem`` rows.
 *
 * Accepts an object (``{"items": [...]}``), a bare array, or a string
 * carrying JSON (optionally fenced or embedded in prose).
 *
 * @throws Error when the payload carries no item list at all.
 */
export function parseItemsPayload(payload: unknown): RecognizedItem[] {
    let decoded: unknown = typeof payload === "string" ? decodeJsonText(payload) : payload;
    if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        decoded = (decoded as Record<string, unknown>).items;
    }
    if (!Array.isArray(decoded)) {
        throw new Error("model response carries no item list");
    }
    const recognized: RecognizedItem[] = [];
    for (const entry of decoded) {
        const row = toRecognizedItem(entry);
        if (row) recognized.push(row);
    }
    return recognized;
}

function decodeJsonText(rawText: string): unknown {
    const stripped = stripFences(rawText.trim());
    try {
        return JSON.parse(stripped);
    } catch {
        const fragment = extractJsonFragment(stripped);
        if (fragment === null) {
            throw new Error("model response contains no JSON");
        }
        return JSON.parse(fragment);
    }
}

function stripFences(rawText: string): string {
    if (!rawText.startsWith("```")) return rawText;
    return rawText.replace(FENCE_OPEN_RE, "").replace(FENCE_CLOSE_RE, "");
}

function extractJsonFragment(rawText: string): string | null {
    for (let start = 0; start < rawText.length; start += 1) {
        const startChar = rawText[start];
        if (startChar !== "[" && startChar !== "{") continue;
        // Find the shortest parseable prefix from this opening bracket by
        // scanning matching close positions; JSON.parse validates.
        const fragment = tryDecodeFrom(rawText, start);
        if (fragment !== null) return fragment;
    }
    return null;
}

function tryDecodeFrom(rawText: string, start: number): string | null {
    const open = rawText[start];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < rawText.length; index += 1) {
        const char = rawText[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
        } else if (char === open) {
            depth += 1;
        } else if (char === close) {
            depth -= 1;
            if (depth === 0) {
                const candidate = rawText.slice(start, index + 1);
                try {
                    JSON.parse(candidate);
                    return candidate;
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

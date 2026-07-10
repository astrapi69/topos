/**
 * Client-side AI provider presets for the local (no-backend) mode.
 *
 * Mirror of ``backend/app/ai/providers.py`` - keep the two lists in
 * sync when a provider or model suggestion changes. When a backend is
 * reachable the Settings UI fetches the authoritative list from
 * ``GET /api/settings/ai/providers``; this mirror only serves the
 * Dexie-only PWA (GitHub Pages, no backend) so the AI settings stay
 * fully functional there, following the adaptive-learner pattern.
 */

import type {AiProvider} from "../api/client";

export const AI_PROVIDER_PRESETS: AiProvider[] = [
    {
        id: "anthropic",
        label: "Anthropic (Claude)",
        baseUrl: "https://api.anthropic.com/v1",
        defaultModel: "claude-sonnet-4-6",
        models: [
            {id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", vision: true},
            {id: "claude-opus-4-8", label: "Claude Opus 4.8", vision: true},
            {id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", vision: true},
        ],
        envVar: "TOPOS_ANTHROPIC_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: false,
        note: "",
    },
    {
        id: "openai",
        label: "OpenAI (GPT)",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        models: [
            {id: "gpt-4o-mini", label: "GPT-4o mini", vision: true},
            {id: "gpt-4o", label: "GPT-4o", vision: true},
        ],
        envVar: "TOPOS_OPENAI_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: false,
        note: "",
    },
    {
        id: "google",
        label: "Google (Gemini)",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        defaultModel: "gemini-2.0-flash",
        models: [
            {id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", vision: true},
            {id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", vision: true},
            {id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", vision: true},
        ],
        envVar: "TOPOS_GEMINI_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: false,
        note: "",
    },
    {
        id: "custom",
        label: "Custom (OpenAI-compatible)",
        baseUrl: "",
        defaultModel: "",
        models: [],
        envVar: "TOPOS_CUSTOM_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: true,
        note: "vision_depends_on_model",
    },
];

/** Preset lookup by provider id, or ``undefined`` for unknown ids. */
export function getProviderPreset(providerId: string): AiProvider | undefined {
    return AI_PROVIDER_PRESETS.find((preset) => preset.id === providerId);
}

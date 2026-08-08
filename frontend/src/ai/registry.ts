/**
 * Topos AI provider registry, built on ``@astrapi69/ai-key-vault``'s
 * data-driven registry (``createProviderRegistry`` + descriptor objects).
 *
 * Replaces the hand-maintained ``AI_PROVIDER_PRESETS`` mirror. The kit ships
 * ``BUILTIN_PROVIDERS`` (anthropic / openai / gemini), but Topos keeps three
 * project-specific deviations, so the descriptors are declared explicitly
 * rather than reused verbatim:
 *
 *  - **Provider id ``google``** (not the kit's ``gemini``). The backend
 *    config chain, the ``/api/settings/ai/*`` endpoints and the vision
 *    client (``browserAiClient``) all key on ``google``; keeping the id
 *    avoids a translation layer at every boundary.
 *  - **``corsBlocked`` gating (empirically measured, not assumed).** An
 *    earlier version guessed that only Anthropic was browser-direct. A CORS
 *    probe against the real APIs from the Pages origin (dummy keys, observing
 *    reached-vs-blocked) corrected that: anthropic (dangerous-direct opt-in),
 *    google (generativelanguage.googleapis.com), and perplexity all allow the
 *    browser-direct vision POST. Only **OpenAI** blocks it -- GET /models
 *    reaches, but POST /chat/completions returns "Failed to fetch" (CORS) --
 *    so ``openai`` stays ``corsBlocked``. ``custom`` stays ``corsBlocked``
 *    until a concrete endpoint proves otherwise. The settings UI reports the
 *    blocked ones ``desktop_only`` (they need the backend).
 *  - **``custom`` OpenAI-compatible provider.** The backend chain supports a
 *    custom (self-hosted / OpenAI-compatible) provider. The kit's 0.1.x panel
 *    has no base-URL field, so Topos renders its own ``CustomEndpointField``
 *    (a base-URL input wired through the adapter's ``baseUrlOverride``) next to
 *    the panel when ``custom`` is the active provider. ``custom`` is
 *    ``corsBlocked`` so browser-direct mode reports it desktop-only; it is
 *    primarily a backend-mode provider (an https PWA cannot reach a local
 *    http endpoint anyway).
 */

import {
  createProviderRegistry,
  PERPLEXITY_PROVIDER,
  type AiProviderDescriptor,
  type ProviderRegistry,
} from "@astrapi69/ai-key-vault";

/** The provider ids Topos knows. Kept in sync with the backend chain. */
export type ToposProviderId =
  "anthropic" | "openai" | "google" | "perplexity" | "custom";

/** Provider descriptors in UI order (drives the settings select). */
export const TOPOS_PROVIDERS: readonly AiProviderDescriptor<ToposProviderId>[] =
  [
    {
      id: "anthropic",
      label: "Anthropic (Claude)",
      keyFormat: { prefix: "sk-ant-", minLength: 40 },
      keyFormatHint: "Starts with sk-ant-",
      defaultModel: "claude-sonnet-4-6",
      recommendedModels: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-4"],
      baseUrl: "https://api.anthropic.com/v1",
      requiresApiKey: true,
      // The only provider with a browser-direct opt-in.
      corsBlocked: false,
    },
    {
      id: "openai",
      label: "OpenAI (GPT)",
      keyFormat: { prefix: "sk-", minLength: 20, rejectPrefixes: ["sk-ant-"] },
      keyFormatHint: "Starts with sk-",
      defaultModel: "gpt-4o-mini",
      recommendedModels: ["gpt-4o-mini", "gpt-4o"],
      baseUrl: "https://api.openai.com/v1",
      requiresApiKey: true,
      // Open CORS in theory, but Topos gates it behind the backend.
      corsBlocked: true,
    },
    {
      id: "google",
      label: "Google (Gemini)",
      keyFormat: { minLength: 20, rejectPrefixes: ["sk-"] },
      keyFormatHint: "At least 20 characters",
      defaultModel: "gemini-2.0-flash",
      recommendedModels: [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
      ],
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      requiresApiKey: true,
      // Empirically browser-direct: generativelanguage.googleapis.com allows
      // CORS for POST generateContent (probe from the Pages origin -> 400
      // reached with a dummy key). Callable in the no-backend PWA.
      corsBlocked: false,
    },
    // Perplexity: reuse the kit's descriptor (OpenAI-compatible) but override
    // corsBlocked -> the kit ships it backend-only, yet api.perplexity.ai
    // allows CORS for POST chat/completions (probe -> 401 reached). Callable
    // browser-direct like anthropic/google.
    { ...PERPLEXITY_PROVIDER, corsBlocked: false },
    {
      id: "custom",
      label: "Custom (OpenAI-compatible)",
      // Self-hosted keys have no reliable shape; only reject inner whitespace.
      keyFormat: { minLength: 0 },
      keyFormatHint: "Any token accepted by your endpoint",
      defaultModel: "",
      // The user supplies the base URL via CustomEndpointField.
      baseUrl: "",
      requiresApiKey: true,
      corsBlocked: true,
    },
  ];

/** Ready-made registry over the Topos provider set. */
export const TOPOS_REGISTRY: ProviderRegistry<ToposProviderId> =
  createProviderRegistry(TOPOS_PROVIDERS);

/**
 * Whether a provider can be reached straight from the browser (no backend).
 * Only Anthropic can; mirrors the old ``supportsBrowserDirect`` helper.
 */
export function supportsBrowserDirect(providerId: string): boolean {
  const descriptor = TOPOS_REGISTRY.find(providerId);
  return descriptor ? descriptor.corsBlocked !== true : false;
}

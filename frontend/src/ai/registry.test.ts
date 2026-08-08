import { describe, it, expect } from "vitest";

import { TOPOS_REGISTRY, supportsBrowserDirect } from "./registry";

describe("TOPOS_REGISTRY", () => {
  it("includes Perplexity as an OpenAI-compatible provider", () => {
    expect(TOPOS_REGISTRY.has("perplexity")).toBe(true);
    const perplexity = TOPOS_REGISTRY.get("perplexity");
    expect(perplexity.baseUrl).toBe("https://api.perplexity.ai");
  });

  // Ground truth from an empirical CORS probe against the real APIs from the
  // GitHub Pages origin (dummy keys, observing whether the request reaches the
  // server vs. is CORS-blocked).
  //   anthropic  GET /models          -> 401 reached (dangerous-direct opt-in)
  //   google     POST generateContent -> 400 reached (CORS allowed)
  //   perplexity POST chat/completions -> 401 reached (CORS allowed)
  //   openai     POST chat/completions -> Failed to fetch (CORS-BLOCKED)
  //   custom     unknown endpoint      -> backend-only until proven
  it("marks browser-direct providers per the empirical CORS matrix", () => {
    expect(supportsBrowserDirect("anthropic")).toBe(true);
    expect(supportsBrowserDirect("google")).toBe(true);
    expect(supportsBrowserDirect("perplexity")).toBe(true);
    expect(supportsBrowserDirect("openai")).toBe(false);
    expect(supportsBrowserDirect("custom")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

import { TOPOS_REGISTRY, supportsBrowserDirect } from "./registry";

describe("TOPOS_REGISTRY", () => {
  it("includes Perplexity as an OpenAI-compatible, backend-only provider", () => {
    expect(TOPOS_REGISTRY.has("perplexity")).toBe(true);
    const perplexity = TOPOS_REGISTRY.get("perplexity");
    expect(perplexity.baseUrl).toBe("https://api.perplexity.ai");
    // corsBlocked -> not callable straight from the browser (backend only).
    expect(supportsBrowserDirect("perplexity")).toBe(false);
  });

  it("keeps Anthropic as the only browser-direct provider", () => {
    expect(supportsBrowserDirect("anthropic")).toBe(true);
    expect(supportsBrowserDirect("openai")).toBe(false);
    expect(supportsBrowserDirect("google")).toBe(false);
    expect(supportsBrowserDirect("custom")).toBe(false);
  });
});

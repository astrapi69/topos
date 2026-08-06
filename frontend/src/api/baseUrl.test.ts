import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiBase, getBackendUrl, setBackendUrl } from "./baseUrl";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("baseUrl", () => {
  it("defaults to same-origin /api at root base", () => {
    expect(getBackendUrl()).toBe("");
    expect(apiBase()).toBe("/api");
  });

  it("respects the Vite base path for same-origin (subpath deploy)", () => {
    // GitHub Pages serves under /topos/, so same-origin API must target
    // /topos/api, not the wrong root /api.
    vi.stubEnv("BASE_URL", "/topos/");
    expect(apiBase()).toBe("/topos/api");
  });

  it("uses the configured backend origin", () => {
    setBackendUrl("http://vps.example:8010");
    expect(getBackendUrl()).toBe("http://vps.example:8010");
    expect(apiBase()).toBe("http://vps.example:8010/api");
  });

  it("strips trailing slashes when storing", () => {
    setBackendUrl("http://vps.example:8010///");
    expect(getBackendUrl()).toBe("http://vps.example:8010");
    expect(apiBase()).toBe("http://vps.example:8010/api");
  });

  it("lets an explicit origin override the stored value", () => {
    setBackendUrl("http://stored:1");
    expect(apiBase("http://typed:2")).toBe("http://typed:2/api");
  });

  it("clears the configured url when set to empty", () => {
    setBackendUrl("http://vps.example:8010");
    setBackendUrl("");
    expect(getBackendUrl()).toBe("");
    expect(apiBase()).toBe("/api");
  });
});

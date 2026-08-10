// TEMPLATE: This test is included as adaptable example.
// Replace with your domain logic when project domain is finalized.

/**
 * Tests for the build-time/runtime version cross-check.
 *
 * The frontend __APP_VERSION__ is a Vite build-time literal; the
 * backend ships its own version via /api/health. A mismatch is a
 * stale-build signal. The check fails open on every error path so
 * offline boot or a backend that hasn't started yet never breaks
 * the app.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { verifyBackendVersion } from "./versionCheck";
import { _resetBackendProbe } from "./backendStatus";

const APP = __APP_VERSION__;

describe("verifyBackendVersion", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The check runs behind the shared backend probe; reset it so each
    // test decides for itself whether a backend answers.
    _resetBackendProbe();
    localStorage.clear();
    vi.unstubAllEnvs();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("does not warn when versions match", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP, status: "ok" }),
    });

    await verifyBackendVersion();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns with both versions on mismatch", async () => {
    const fakeBackend = "9.9.9-stale";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: fakeBackend, status: "ok" }),
    });

    await verifyBackendVersion();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain(`frontend=${APP}`);
    expect(message).toContain(`backend=${fakeBackend}`);
  });

  it("fails open on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(verifyBackendVersion()).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fails open on non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await verifyBackendVersion();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fails open when version field is missing or wrong type", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    await verifyBackendVersion();
    expect(warnSpy).not.toHaveBeenCalled();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 42 }),
    });

    await verifyBackendVersion();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fails open when JSON parse throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });

    await verifyBackendVersion();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("probes through apiBase, not a bare /api path", async () => {
    // Regression: a hardcoded "/api/health" ignores the deployment base
    // path, so the GitHub Pages build hit astrapi69.github.io/api/health
    // (404) instead of the app's own /topos/api/health.
    localStorage.setItem("topos.backend_url", "https://backend.example");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: APP }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyBackendVersion();

    const probed = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(probed).toContain("https://backend.example/api/health");
    expect(probed).not.toContain("/api/health");
  });

  it("does not touch the network when no backend can answer", async () => {
    // Static PWA build: nothing to cross-check against, and the request
    // would only 404 on every load.
    vi.stubEnv("VITE_STORAGE_MODE", "dexie");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await verifyBackendVersion();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

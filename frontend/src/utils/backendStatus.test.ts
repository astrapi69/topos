import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isBackendAvailable, _resetBackendProbe } from "./backendStatus";

beforeEach(() => {
  _resetBackendProbe();
  localStorage.clear();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("isBackendAvailable", () => {
  it("returns true when /api/health responds ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await isBackendAvailable()).toBe(true);
  });

  it("returns false when the probe rejects (no backend)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await isBackendAvailable()).toBe(false);
  });

  it("returns false on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await isBackendAvailable()).toBe(false);
  });

  it("probes only once and caches the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await isBackendAvailable();
    await isBackendAvailable();
    await isBackendAvailable();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.anything());
  });

  // The GitHub Pages build ships VITE_STORAGE_MODE=dexie and has no
  // backend at all. Probing there guarantees a 404 in the console on
  // every load; skip the request entirely unless the user connected a
  // backend from Settings.
  it("skips the probe in the dexie build when no backend is configured", async () => {
    vi.stubEnv("VITE_STORAGE_MODE", "dexie");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await isBackendAvailable()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still probes in the dexie build once a backend URL is configured", async () => {
    vi.stubEnv("VITE_STORAGE_MODE", "dexie");
    localStorage.setItem("topos.backend_url", "https://backend.example");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await isBackendAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/api/health",
      expect.anything(),
    );
  });
});

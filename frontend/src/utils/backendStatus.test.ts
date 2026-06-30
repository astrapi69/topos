import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {isBackendAvailable, _resetBackendProbe} from "./backendStatus";

beforeEach(() => {
    _resetBackendProbe();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isBackendAvailable", () => {
    it("returns true when /api/health responds ok", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true}));
        expect(await isBackendAvailable()).toBe(true);
    });

    it("returns false when the probe rejects (no backend)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        expect(await isBackendAvailable()).toBe(false);
    });

    it("returns false on a non-ok response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: false}));
        expect(await isBackendAvailable()).toBe(false);
    });

    it("probes only once and caches the result", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ok: true});
        vi.stubGlobal("fetch", fetchMock);
        await isBackendAvailable();
        await isBackendAvailable();
        await isBackendAvailable();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.anything());
    });
});

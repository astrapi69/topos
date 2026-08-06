import { describe, expect, it } from "vitest";

import { CURRENT_BUILD, appUpdateStore, versionJsonUrl } from "./update-store";

describe("pwa/update-store", () => {
  it("builds the manifest URL from the Vite base path", () => {
    // BASE_URL is "/" in tests; the deployed GH-Pages build uses "/topos/".
    expect(versionJsonUrl()).toMatch(/\/version\.json$/);
  });

  it("reads the running build from the Vite define literals", () => {
    expect(typeof CURRENT_BUILD.version).toBe("string");
    expect(typeof CURRENT_BUILD.buildHash).toBe("string");
  });

  it("exposes a store with the useSyncExternalStore contract", () => {
    expect(typeof appUpdateStore.subscribe).toBe("function");
    expect(typeof appUpdateStore.getSnapshot).toBe("function");
    expect(appUpdateStore.getSnapshot()).toHaveProperty("updateAvailable");
  });
});

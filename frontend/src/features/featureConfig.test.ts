import { describe, expect, it } from "vitest";

import {
  FEATURES,
  REASON_BACKEND_REQUIRED,
  featureRegistry,
  type FeatureContext,
} from "./featureConfig";

const ONLINE: FeatureContext = { backendAvailable: true, hasAiKey: false };
const OFFLINE: FeatureContext = { backendAvailable: false, hasAiKey: false };

describe("featureConfig registry", () => {
  it("activates backend-required features when a backend is reachable", () => {
    expect(featureRegistry.getState(FEATURES.EXCEL_IMPORT, ONLINE)).toBe(
      "active",
    );
    expect(featureRegistry.getState(FEATURES.CATEGORY_EDIT, ONLINE)).toBe(
      "active",
    );
  });

  it("disables backend-required features with a reason when offline", () => {
    expect(featureRegistry.getState(FEATURES.EXCEL_IMPORT, OFFLINE)).toBe(
      "disabled",
    );
    expect(featureRegistry.getState(FEATURES.CATEGORY_EDIT, OFFLINE)).toBe(
      "disabled",
    );
    expect(featureRegistry.getReason(FEATURES.CATEGORY_EDIT, OFFLINE)).toBe(
      REASON_BACKEND_REQUIRED,
    );
  });

  it("treats an unknown id as hidden (fail-closed)", () => {
    expect(featureRegistry.getState("no-such-feature", ONLINE)).toBe("hidden");
  });
});

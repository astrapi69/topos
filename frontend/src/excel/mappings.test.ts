import { describe, expect, it } from "vitest";

import { priorityFromGerman, slugifyCategoryPath } from "./mappings";

describe("priorityFromGerman", () => {
  it.each([
    ["sehr hoch", "very_high"],
    ["hoch", "high"],
    ["Mittel", "medium"],
    ["  niedrig ", "low"],
    ["keine", "none"],
    ["", "none"],
  ])("maps %s to %s", (raw, expected) => {
    expect(priorityFromGerman(raw).priority).toBe(expected);
  });

  it("defaults to none without a warning when the cell is empty", () => {
    expect(priorityFromGerman(null)).toEqual({
      priority: "none",
      warning: null,
    });
  });

  it("warns and defaults to none on an unknown value", () => {
    const result = priorityFromGerman("dringend");
    expect(result.priority).toBe("none");
    expect(result.warning).toContain("dringend");
  });
});

describe("slugifyCategoryPath", () => {
  it("returns null for empty input", () => {
    expect(slugifyCategoryPath(null)).toBeNull();
    expect(slugifyCategoryPath("   ")).toBeNull();
  });

  it("maps known German segments to their English slugs", () => {
    const result = slugifyCategoryPath("Finanzen / Bank / Girokonto");
    expect(result?.path).toBe("finance/bank/checking-account");
    expect(result?.segments).toEqual([
      { slug: "finance", display: "Finanzen" },
      { slug: "bank", display: "Bank" },
      { slug: "checking-account", display: "Girokonto" },
    ]);
    expect(result?.warnings).toEqual([]);
  });

  it("falls back to a mechanical slug and warns for unmapped segments", () => {
    const result = slugifyCategoryPath("Möbelhaus Süd");
    expect(result?.path).toBe("moebelhaus-sued");
    expect(result?.warnings).toHaveLength(1);
    expect(result?.warnings[0]).toContain("Möbelhaus Süd");
  });

  it("drops empty segments from trailing or doubled slashes", () => {
    expect(slugifyCategoryPath("Finanzen//Bank/")?.path).toBe("finance/bank");
  });
});

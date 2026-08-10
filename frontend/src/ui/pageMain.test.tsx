/**
 * Regression pin for the centred page column.
 *
 * Every page's <main> must carry a max-width AND `mx-auto`; dropping
 * either makes the page cling to the left edge on wide screens (the
 * max-width alone centres nothing, `mx-auto` alone has nothing to
 * centre within). Asserting on the source files rather than rendering
 * every page keeps the pin cheap and catches a new page that forgets
 * the shared class.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { pageMain, pageMainNarrow } from "./classes";

const PAGES_DIR = join(__dirname, "..", "pages");

function mainOpeningTags(source: string): string[] {
  return [...source.matchAll(/<main[^>]*>/g)].map((match) => match[0]);
}

describe("page <main> wrappers", () => {
  it.each([
    ["pageMain", pageMain],
    ["pageMainNarrow", pageMainNarrow],
  ])("%s centres a bounded column", (_name, value) => {
    expect(value).toContain("mx-auto");
    expect(value).toMatch(/max-w-\w+/);
    expect(value).toContain("w-full");
  });

  it("every page <main> uses a shared centred wrapper", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(PAGES_DIR).filter((name) =>
      name.endsWith(".tsx"),
    )) {
      if (file.endsWith(".test.tsx")) continue;
      const source = readFileSync(join(PAGES_DIR, file), "utf8");
      for (const tag of mainOpeningTags(source)) {
        if (!/pageMain\b|pageMainNarrow\b/.test(tag)) {
          offenders.push(`${file}: ${tag}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

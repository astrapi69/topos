/**
 * Pins STATIC_ROUTES to the router and to the build output.
 *
 * A route that exists in App.tsx but not in STATIC_ROUTES gets no
 * prerendered shell, so GitHub Pages answers its deep link with a 404
 * status (the app still loads via 404.html, but the status is wrong).
 * The reverse - a stale entry in STATIC_ROUTES - emits a shell for a
 * route the router no longer serves.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STATIC_ROUTES } from "./appRoutes";

function routerPaths(): string[] {
  const source = readFileSync(join(__dirname, "App.tsx"), "utf8");
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

describe("STATIC_ROUTES", () => {
  it("covers every parameterless route the router serves", () => {
    const expected = routerPaths()
      .filter((path) => !path.includes(":") && !path.includes("*"))
      .sort();
    expect([...STATIC_ROUTES].sort()).toEqual(expected);
  });

  it("lists only absolute paths (they become directory names in dist)", () => {
    for (const route of STATIC_ROUTES) {
      expect(route.startsWith("/")).toBe(true);
      expect(route).not.toContain(":");
    }
  });
});

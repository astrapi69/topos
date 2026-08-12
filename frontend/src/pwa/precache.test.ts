/**
 * The precache is what every install downloads before the app is usable,
 * so what lands in it is a product decision, not a build detail.
 *
 * Measured on the v0.2.0 bundle: 2.84 MB over 79 entries, because
 * `globPatterns: ["**\/*.{js,css,html,ico,png,svg,woff2}"]` takes every
 * emitted file whether or not anything ever requests it. Two thirds of
 * the excess had a single cause each - the lazy exceljs chunk (908 KB,
 * 31% of the precache, for a workbook feature most sessions never touch)
 * and 340 KB of assets nothing references.
 *
 * These pins are on the config and the asset tree rather than on a built
 * `dist/`, so they run without a build step and fail on the edit that
 * would reintroduce the weight.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");

describe("precache excludes what it should not ship upfront", () => {
  it("keeps the lazy exceljs chunk out of the precache", () => {
    // exceljs is behind a dynamic import precisely so it only reaches a
    // session that exports or imports a workbook (CLAUDE.md,
    // "Performance"). Precaching it defeats that on every install.
    expect(viteConfig).toMatch(/globIgnores/);
    expect(viteConfig).toMatch(/exceljs[^"']*\*/);
  });

  it("caches exceljs at runtime instead, so offline export still works", () => {
    // Dropped from the precache, the chunk still has to survive offline
    // once it has been fetched: a runtime rule, not nothing.
    const runtime = viteConfig.slice(viteConfig.indexOf("runtimeCaching"));
    expect(runtime).toMatch(/exceljs/);
  });

  it("keeps the social preview image out of the precache", () => {
    // og-image is for link unfurls (og:image / twitter:image). It is
    // never requested by the running app, let alone offline.
    expect(viteConfig).toMatch(/og-image/);
  });
});

describe("public/ carries only referenced assets", () => {
  const publicDir = join(ROOT, "public");
  const html = readFileSync(join(ROOT, "index.html"), "utf8");

  it("has no leftover root-level icon duplicates", () => {
    // icon-192.png / icon-512.png in the root were a second icon set,
    // not byte-identical to the icons/ ones and referenced by nothing.
    const rootFiles = readdirSync(publicDir);
    expect(rootFiles).not.toContain("icon-192.png");
    expect(rootFiles).not.toContain("icon-512.png");
  });

  it("ships only the icon sizes the manifest or index.html names", () => {
    const icons = readdirSync(join(publicDir, "icons"));
    const referenced = icons.filter(
      (name) => html.includes(name) || viteConfig.includes(name),
    );
    expect(icons.sort()).toEqual(referenced.sort());
  });
});

describe("chunk map has no dead entries", () => {
  it("no longer maps a vendor-tiptap chunk", () => {
    // TipTap was removed in the v0.2.0 dependency cleanup: 27 packages,
    // zero imports. The mapping outlived the dependency.
    expect(viteConfig).not.toContain("vendor-tiptap");
    expect(viteConfig).not.toContain("@tiptap/");
  });
});

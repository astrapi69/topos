/**
 * The manifest is the install contract: what the browser shows in its
 * install UI, what the launcher looks like afterwards, and how the app is
 * identified across deploys. The v0.2.0 audit found it thin - no `id`, no
 * screenshots (so Android showed only the narrow install card), no
 * shortcuts, a maskable icon in one size, `orientation: "portrait"`
 * applied to desktop installs too, and a hardcoded `lang: "de"` on an
 * app that switches between eight locales at runtime.
 *
 * Pinned against vite.config.ts and the asset tree, so no build needed.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
/** The `manifest: { ... }` block, so assertions cannot match elsewhere. */
const manifestBlock = viteConfig.slice(
  viteConfig.indexOf("manifest: {"),
  viteConfig.indexOf("workbox: {"),
);

describe("manifest identity and window behaviour", () => {
  it("declares an explicit id, so the identity survives a start_url change", () => {
    expect(manifestBlock).toMatch(/\bid:/);
  });

  it("does not lock installs to portrait", () => {
    // The same manifest serves phone and desktop installs; portrait-only
    // is wrong for a window the user can resize.
    expect(manifestBlock).not.toMatch(/orientation:\s*"portrait"/);
  });

  it("declares the default catalog as lang, not the plugin's fallback", () => {
    // Dropping `lang` does not leave it out: vite-plugin-pwa injects
    // `lang: "en"` when the field is absent (verified against the built
    // manifest.webmanifest). Under a German `name` that is the worse of
    // the two wrong answers, so the field names the default catalog - the
    // language an install actually starts in.
    expect(manifestBlock).toMatch(/lang:\s*"de"/);
  });
});

describe("manifest install UI", () => {
  it("offers screenshots for both form factors", () => {
    expect(manifestBlock).toMatch(/screenshots:/);
    expect(manifestBlock).toMatch(/form_factor:\s*"wide"/);
    expect(manifestBlock).toMatch(/form_factor:\s*"narrow"/);
  });

  it("ships the screenshot files the manifest names", () => {
    const named = [...manifestBlock.matchAll(/"(screenshots\/[^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(named.length).toBeGreaterThanOrEqual(2);
    for (const src of named) {
      expect(existsSync(join(ROOT, "public", src))).toBe(true);
    }
  });

  it("keeps screenshots out of the precache", () => {
    // Install-UI images only. The running app never requests them, so they
    // have no business in what every install downloads upfront.
    const start = viteConfig.indexOf("globIgnores");
    const globIgnores = viteConfig.slice(
      start,
      viteConfig.indexOf("],", start),
    );
    expect(globIgnores).toContain("screenshots");
  });

  it("declares shortcuts into the three entry points", () => {
    expect(manifestBlock).toMatch(/shortcuts:/);
    for (const route of ["containers", "photo-intake", "actions"]) {
      expect(manifestBlock).toContain(route);
    }
  });
});

describe("maskable icons", () => {
  it("ships maskable at 192 as well as 512", () => {
    // Android picks the maskable icon per density; with only 512 present,
    // small launchers downscale a 512 PNG on every draw.
    expect(
      existsSync(join(ROOT, "public", "icons", "maskable-icon-192x192.png")),
    ).toBe(true);
    expect(manifestBlock).toContain("maskable-icon-192x192.png");
  });
});

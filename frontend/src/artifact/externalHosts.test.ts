/**
 * The external-hosts guard: what the built bundle may reference outside
 * its own origin is a privacy decision, so every host is either on the
 * allowlist with a written reason or the build is red.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditDist,
  extractHosts,
  findForbiddenTags,
  type Allowlist,
} from "./externalHosts";

const SELF = "astrapi69.github.io";

function allowlist(
  hosts: Record<string, Partial<Allowlist["hosts"][string]>>,
): Allowlist {
  const entries: Allowlist["hosts"] = {};
  for (const [host, entry] of Object.entries(hosts)) {
    entries[host] = {
      category: "link",
      purpose: "test",
      trigger: "test",
      ...entry,
    };
  }
  return { hosts: entries };
}

describe("extractHosts", () => {
  it("collects https, http and protocol-relative hosts, lower-cased", () => {
    const hosts = extractHosts(
      'a "https://API.Anthropic.com/v1" b http://schema.org c //cdn.example/x.js d https://api.anthropic.com/v1/models',
    );
    expect(hosts.get("api.anthropic.com")).toBe(2);
    expect(hosts.get("schema.org")).toBe(1);
    expect(hosts.get("cdn.example")).toBe(1);
  });

  it("returns an empty map for text without URLs", () => {
    expect(extractHosts("const x = 1; // no urls here").size).toBe(0);
  });

  it("does not read a bare 'https://' without host as a host", () => {
    expect(extractHosts("baseUrl: `https://...`").size).toBe(0);
  });
});

describe("findForbiddenTags", () => {
  const self = new Set([SELF]);

  it("flags third-party script, stylesheet, image and iframe sources", () => {
    const html = [
      '<script src="https://cdn.example/lib.js"></script>',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
      '<img src="//images.example/a.png">',
      '<iframe src="https://maps.example/embed"></iframe>',
    ].join("\n");
    const hits = findForbiddenTags(html, self);
    expect(hits).toHaveLength(4);
  });

  it("flags preconnect and dns-prefetch hints even to the own host", () => {
    const html = `<link rel="preconnect" href="https://${SELF}"><link rel="dns-prefetch" href="//fonts.gstatic.com">`;
    expect(findForbiddenTags(html, self)).toHaveLength(2);
  });

  it("accepts same-origin, relative and canonical/og references", () => {
    const html = [
      `<link rel="canonical" href="https://${SELF}/topos/">`,
      '<link rel="stylesheet" href="/topos/assets/index.css">',
      '<script type="module" src="/topos/assets/index.js"></script>',
      '<img src="icons/icon-192x192.png">',
      `<meta property="og:image" content="https://${SELF}/topos/og-image.png">`,
    ].join("\n");
    expect(findForbiddenTags(html, self)).toEqual([]);
  });
});

describe("auditDist", () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), "topos-dist-"));
    mkdirSync(join(dist, "assets"));
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it("passes when every referenced host is allowlisted", () => {
    writeFileSync(
      join(dist, "index.html"),
      `<link rel="canonical" href="https://${SELF}/topos/">`,
    );
    writeFileSync(
      join(dist, "assets", "index.js"),
      'fetch("https://api.anthropic.com/v1")',
    );
    const report = auditDist(
      dist,
      allowlist({
        [SELF]: { category: "self" },
        "api.anthropic.com": { category: "api" },
      }),
    );
    expect(report.unknownHosts).toEqual([]);
    expect(report.forbiddenTags).toEqual([]);
    expect(report.staleAllowlist).toEqual([]);
    expect(report.filesScanned).toBe(2);
  });

  it("reports an unknown host with the file it appears in", () => {
    writeFileSync(
      join(dist, "assets", "index.js"),
      'new Image().src = "https://tracker.example/pixel.gif"',
    );
    const report = auditDist(dist, allowlist({}));
    expect(report.unknownHosts).toEqual([
      { host: "tracker.example", file: "assets/index.js", count: 1 },
    ]);
  });

  it("reports third-party tags in every html file, including the prerendered routes", () => {
    mkdirSync(join(dist, "settings"));
    writeFileSync(
      join(dist, "settings", "index.html"),
      '<script src="https://cdn.example/lib.js"></script>',
    );
    const report = auditDist(dist, allowlist({ "cdn.example": {} }));
    expect(report.forbiddenTags).toHaveLength(1);
    expect(report.forbiddenTags[0].file).toBe("settings/index.html");
  });

  it("reports allowlist entries the build no longer references", () => {
    writeFileSync(join(dist, "assets", "index.js"), "const nothing = 1;");
    const report = auditDist(dist, allowlist({ "gone.example": {} }));
    expect(report.staleAllowlist).toEqual(["gone.example"]);
  });

  it("ignores binary assets and scans text formats only", () => {
    writeFileSync(
      join(dist, "assets", "photo.png"),
      "https://binary.example/should/not/count",
    );
    writeFileSync(
      join(dist, "manifest.webmanifest"),
      '{"icons":[{"src":"https://icons.example/i.png"}]}',
    );
    const report = auditDist(dist, allowlist({}));
    expect(report.unknownHosts.map((hit) => hit.host)).toEqual([
      "icons.example",
    ]);
  });
});

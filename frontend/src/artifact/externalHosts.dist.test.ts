/**
 * Guard on the real GitHub-Pages artifact: every host the bundle
 * references is on `external-hosts.allowlist.json` with a reason, and no
 * HTML file loads anything from a third party.
 *
 * Needs a build first:
 *   GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build
 *
 * Without `dist/` the suite skips, so `make test` stays runnable on a
 * fresh checkout; CI sets TOPOS_REQUIRE_DIST=1 after building so a
 * missing artifact fails instead of silently passing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { auditDist, type Allowlist, type DistReport } from "./externalHosts";

const ROOT = join(__dirname, "..", "..");
const DIST = join(ROOT, "dist");
const ALLOWLIST_PATH = join(ROOT, "external-hosts.allowlist.json");
const required = process.env.TOPOS_REQUIRE_DIST === "1";
const hasDist = existsSync(join(DIST, "index.html"));

if (required && !hasDist) {
  throw new Error(
    `TOPOS_REQUIRE_DIST=1 but ${DIST} has no index.html - build first`,
  );
}

describe.skipIf(!hasDist)(
  "built artifact references only allowlisted hosts",
  () => {
    // Vitest still runs a skipped describe's body to collect its tests, so
    // the scan must not happen here: without dist/ it would throw ENOENT
    // during collection and fail the file instead of skipping it.
    let allowlist: Allowlist;
    let report: DistReport;

    beforeAll(() => {
      allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as Allowlist;
      report = auditDist(DIST, allowlist);
    });

    it("scanned the Pages build", () => {
      expect(report.filesScanned).toBeGreaterThan(10);
    });

    it("has no host outside the allowlist", () => {
      expect(report.unknownHosts).toEqual([]);
    });

    it("loads no script, stylesheet, image, frame or connection hint from a third party", () => {
      expect(report.forbiddenTags).toEqual([]);
    });

    it("carries no stale allowlist entry", () => {
      expect(report.staleAllowlist).toEqual([]);
    });

    it("documents every allowlisted host with purpose, trigger and category", () => {
      for (const [host, entry] of Object.entries(allowlist.hosts)) {
        expect(entry.purpose, host).toMatch(/\S/);
        expect(entry.trigger, host).toMatch(/\S/);
        expect(["self", "api", "link", "identifier", "vendor-docs"]).toContain(
          entry.category,
        );
      }
    });
  },
);

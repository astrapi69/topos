/**
 * Static audit of the built artifact for references to foreign hosts.
 *
 * The GitHub-Pages build is a public web service, so every host the
 * bundle can reach is a privacy fact the policy has to describe. This
 * module scans `dist/` for host names in every text asset and for HTML
 * tags that would load something from a third party on page view. The
 * allowlist (`external-hosts.allowlist.json`) pairs each permitted host
 * with its purpose and trigger; `externalHosts.dist.test.ts` turns the
 * scan into a red build.
 *
 * Runtime behaviour (what the app actually requests) is measured
 * separately by `e2e/tools/capture-external-requests.mjs`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

/** Why a host may appear in the bundle. */
export type HostCategory =
  /** The deployment origin itself (canonical, Open Graph, sitemap). */
  | "self"
  /** An API the app calls only on an explicit user action with the user's own key. */
  | "api"
  /** A plain hyperlink the user has to click. */
  | "link"
  /** An XML namespace or JSON-LD context URI; an identifier, never fetched. */
  | "identifier"
  /** A documentation URL inside a library's error message; never fetched. */
  | "vendor-docs";

export interface AllowlistEntry {
  category: HostCategory;
  purpose: string;
  trigger: string;
}

export interface Allowlist {
  hosts: Record<string, AllowlistEntry>;
}

export interface HostHit {
  host: string;
  file: string;
  count: number;
}

export interface ForbiddenTag {
  file: string;
  tag: string;
}

export interface DistReport {
  filesScanned: number;
  unknownHosts: HostHit[];
  forbiddenTags: ForbiddenTag[];
  staleAllowlist: string[];
}

/** Assets that can carry a URL as text; images and fonts are skipped. */
export const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".webmanifest",
  ".xml",
  ".txt",
  ".svg",
]);

const HOST_PATTERN =
  /(?:https?:)?\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})(?![a-z0-9.-])/gi;
const LOADING_TAG_PATTERN =
  /<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi;
const REL_PATTERN = /\brel\s*=\s*["']?([^"'>\s]+)/i;
const URL_ATTRIBUTE_PATTERN =
  /\b(?:src|href|data)\s*=\s*["']?((?:https?:)?\/\/[^"'>\s]+)/i;
const CONNECTION_HINTS = new Set(["preconnect", "dns-prefetch"]);

/** Count every host referenced by an absolute or protocol-relative URL. */
export function extractHosts(text: string): Map<string, number> {
  const hosts = new Map<string, number>();
  for (const match of text.matchAll(HOST_PATTERN)) {
    const host = match[1].toLowerCase();
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  return hosts;
}

/**
 * Tags that would make the browser contact another host on page view.
 * Connection hints are flagged even towards the own host: the app has
 * no reason to warm a connection, so one appearing is a mistake.
 */
export function findForbiddenTags(
  html: string,
  selfHosts: Set<string>,
): string[] {
  const hits: string[] = [];
  for (const match of html.matchAll(LOADING_TAG_PATTERN)) {
    const tag = match[0];
    const rel = REL_PATTERN.exec(tag)?.[1].toLowerCase();
    if (rel && CONNECTION_HINTS.has(rel)) {
      hits.push(tag);
      continue;
    }
    const target = URL_ATTRIBUTE_PATTERN.exec(tag)?.[1];
    if (!target) continue;
    const host = new URL(
      target,
      "https://placeholder.invalid",
    ).hostname.toLowerCase();
    if (!selfHosts.has(host)) hits.push(tag);
  }
  return hits;
}

function listTextFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTextFiles(path));
    } else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files.sort();
}

function selfHostsOf(allowlist: Allowlist): Set<string> {
  return new Set(
    Object.entries(allowlist.hosts)
      .filter(([, entry]) => entry.category === "self")
      .map(([host]) => host.toLowerCase()),
  );
}

/** Scan a built `dist/` directory against the allowlist. */
export function auditDist(distDir: string, allowlist: Allowlist): DistReport {
  const selfHosts = selfHostsOf(allowlist);
  const allowed = new Set(
    Object.keys(allowlist.hosts).map((host) => host.toLowerCase()),
  );
  const seen = new Set<string>();
  const unknownHosts: HostHit[] = [];
  const forbiddenTags: ForbiddenTag[] = [];
  const files = listTextFiles(distDir);

  for (const path of files) {
    const file = relative(distDir, path);
    const text = readFileSync(path, "utf8");
    for (const [host, count] of extractHosts(text)) {
      seen.add(host);
      if (!allowed.has(host)) unknownHosts.push({ host, file, count });
    }
    if (extname(path).toLowerCase() === ".html") {
      for (const tag of findForbiddenTags(text, selfHosts))
        forbiddenTags.push({ file, tag });
    }
  }

  const staleAllowlist = [...allowed].filter((host) => !seen.has(host)).sort();
  unknownHosts.sort(
    (a, b) => a.host.localeCompare(b.host) || a.file.localeCompare(b.file),
  );
  return {
    filesScanned: files.length,
    unknownHosts,
    forbiddenTags,
    staleAllowlist,
  };
}

/**
 * The imprint and the privacy policy are static HTML files in public/
 * (so they stay reachable without JavaScript and when the app itself
 * fails to boot). Their wording is content, but a few properties are
 * testable and worth pinning: they name the real operator and nothing
 * is left as a placeholder, they are Topos text and not the sibling
 * project's, they link each other, and their tiny theme script agrees
 * with the app's theme families.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEMES } from "../themes/themes";

const ROOT = join(__dirname, "..", "..");

const OPERATOR = {
  name: "Asterios Raptis",
  address: "Seestraße 68, 71638 Ludwigsburg",
  email: "asterios.raptis@web.de",
};

const PAGES = [
  {
    file: "impressum.html",
    lang: "de",
    root: "legal-page-impressum",
    sibling: "datenschutz.html",
    other: "imprint.html",
    date: "17. September 2026",
  },
  {
    file: "datenschutz.html",
    lang: "de",
    root: "legal-page-datenschutz",
    sibling: "impressum.html",
    other: "privacy.html",
    date: "17. September 2026",
  },
  {
    file: "imprint.html",
    lang: "en",
    root: "legal-page-imprint",
    sibling: "privacy.html",
    other: "impressum.html",
    date: "17 September 2026",
  },
  {
    file: "privacy.html",
    lang: "en",
    root: "legal-page-privacy",
    sibling: "imprint.html",
    other: "datenschutz.html",
    date: "17 September 2026",
  },
] as const;

function load(file: string): { html: string; doc: Document } {
  const html = readFileSync(join(ROOT, "public", file), "utf8");
  return { html, doc: new DOMParser().parseFromString(html, "text/html") };
}

describe.each(PAGES)("$file", (page) => {
  const { html, doc } = load(page.file);
  const text = doc.body.textContent ?? "";

  it("is a noindex page in its own language with its test root", () => {
    expect(doc.documentElement.getAttribute("lang")).toBe(page.lang);
    expect(
      doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex");
    expect(doc.title).toContain("Topos");
    expect(doc.querySelector(`[data-testid="${page.root}"]`)).not.toBeNull();
  });

  it("names the operator with a reachable email and a version date", () => {
    expect(text).toContain(OPERATOR.name);
    expect(text).toContain(OPERATOR.address);
    expect(
      doc.querySelector(`a[href="mailto:${OPERATOR.email}"]`),
    ).not.toBeNull();
    expect(text).toContain(page.date);
  });

  it("is final: no placeholder, no draft notice, no invented VAT id", () => {
    expect(html).not.toMatch(
      /\[\[|TODO|TBD|data-placeholder|legal-draft-notice/,
    );
    expect(text).not.toMatch(/\bEntwurf\b|\bdraft\b|USt-Id|\bVAT\b/i);
  });

  it("is Topos text, not a sibling project's", () => {
    expect(text).toContain("Topos");
    expect(text).not.toMatch(
      /Bibliogon|Adaptive Learner|Amazon|KDP|Medium|Mistral|YouTube|Lerninhalte|PayPal/,
    );
  });

  it("links back to the app, to its sibling page and to the other language", () => {
    expect(
      doc.querySelector('[data-testid="legal-link-app"]')?.getAttribute("href"),
    ).toBe("./");
    expect(doc.querySelector(`nav a[href="./${page.sibling}"]`)).not.toBeNull();
    expect(
      doc
        .querySelector('[data-testid="legal-link-lang"]')
        ?.getAttribute("href"),
    ).toBe(`./${page.other}`);
  });

  it("loads nothing from another host", () => {
    for (const element of doc.querySelectorAll(
      "link[href], script[src], img[src]",
    )) {
      const target =
        element.getAttribute("href") ?? element.getAttribute("src") ?? "";
      expect(target, element.outerHTML).not.toMatch(/^(https?:)?\/\//);
    }
    for (const match of html.matchAll(/url\(\s*["']?([^"')]+)/g)) {
      expect(match[1]).not.toMatch(/^(https?:)?\/\//);
    }
  });
});

describe.each(
  PAGES.filter(
    (page) =>
      page.file.includes("privacy") || page.file.includes("datenschutz"),
  ),
)("$file describes what the web app does", (page) => {
  const { doc } = load(page.file);
  const text = doc.body.textContent ?? "";

  it("covers hosting, storage, AI with the user's own key, error report and the launcher", () => {
    for (const fact of [
      "GitHub Pages",
      "IndexedDB",
      "localStorage",
      "Anthropic",
      "OpenAI",
      "Google",
      "Perplexity",
      "api.github.com",
    ]) {
      expect(text, fact).toContain(fact);
    }
    expect(
      doc.querySelector(
        'a[href="https://github.com/astrapi69/topos/blob/main/PRIVACY.md"]',
      ),
    ).not.toBeNull();
  });
});

describe("theme script shared by the legal pages", () => {
  it("maps the stored app theme to the same light/dark family as the app", () => {
    const script = readFileSync(
      join(ROOT, "public", "legal", "theme.js"),
      "utf8",
    );
    const ids = /var DARK_IDS = \{([^}]*)\}/.exec(script)?.[1] ?? "";
    const darkIds = [...ids.matchAll(/"?([a-z-]+)"?\s*:/g)]
      .map((match) => match[1])
      .sort();
    const expected = THEMES.filter((theme) => theme.family === "dark")
      .map((theme) => theme.id)
      .sort();
    expect(darkIds).toEqual(expected);
  });

  it("is loaded by every page before the stylesheet", () => {
    for (const page of PAGES) {
      const { html } = load(page.file);
      const script = html.indexOf('src="./legal/theme.js"');
      const style = html.indexOf('href="./legal/legal.css"');
      expect(script, page.file).toBeGreaterThan(-1);
      expect(style, page.file).toBeGreaterThan(script);
    }
  });
});

describe("service worker", () => {
  it("never answers a legal page with the app shell", () => {
    const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    expect(viteConfig).toMatch(
      /navigateFallbackDenylist:[^\]]*impressum\|datenschutz\|imprint\|privacy/,
    );
  });
});

/**
 * The legal texts are content, not code, but two things about them are
 * testable: they name the real operator (no placeholder ever ships) and
 * they were adapted from the sibling project rather than pasted.
 */
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { OPERATOR } from "./operator";
import {
  LEGAL_KINDS,
  LEGAL_LOCALES,
  getLegalDocument,
  pickLegalLocale,
  type LegalKind,
  type LegalLocale,
} from "./index";

function renderText(kind: LegalKind, locale: LegalLocale): string {
  const { Content } = getLegalDocument(kind, locale);
  const { container } = render(
    <MemoryRouter>
      <Content />
    </MemoryRouter>,
  );
  return container.textContent ?? "";
}

function renderLinks(kind: LegalKind, locale: LegalLocale): string[] {
  const { Content } = getLegalDocument(kind, locale);
  const { container } = render(
    <MemoryRouter>
      <Content />
    </MemoryRouter>,
  );
  return [...container.querySelectorAll("a")].map(
    (a) => a.getAttribute("href") ?? "",
  );
}

describe("pickLegalLocale", () => {
  it("serves German to every German variant", () => {
    expect(pickLegalLocale("de")).toBe("de");
    expect(pickLegalLocale("de-AT")).toBe("de");
  });

  it("falls back to English for every other language, including unknown", () => {
    for (const lang of [
      "en",
      "en-US",
      "fr",
      "es",
      "el",
      "pt",
      "tr",
      "ja",
      "",
    ]) {
      expect(pickLegalLocale(lang), lang).toBe("en");
    }
  });
});

describe("operator details", () => {
  it("carry no placeholder", () => {
    for (const value of Object.values(OPERATOR)) {
      expect(value).not.toMatch(/\[\[|TODO|TBD|xxx/i);
      expect(value).toMatch(/\S/);
    }
  });
});

describe("legal documents", () => {
  const combos = LEGAL_KINDS.flatMap((kind) =>
    LEGAL_LOCALES.map((locale) => [kind, locale] as const),
  );

  it.each(combos)(
    "%s/%s names the operator and carries a title and date",
    (kind, locale) => {
      const doc = getLegalDocument(kind, locale);
      expect(doc.title).toMatch(/\S/);
      expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const text = renderText(kind, locale);
      expect(text).toContain(OPERATOR.name);
      expect(text).toContain(OPERATOR.email);
    },
  );

  it.each(combos)(
    "%s/%s is Topos text, not the sibling project's",
    (kind, locale) => {
      const text = renderText(kind, locale);
      expect(text).not.toMatch(/adaptive[ -]?learner/i);
      expect(text).not.toMatch(
        /Lerninhalte|Lektionssets|lesson sets|YouTube|Amazon/,
      );
      expect(text).toContain("Topos");
    },
  );

  it.each(LEGAL_LOCALES)("imprint/%s links to the privacy policy", (locale) => {
    expect(renderLinks("imprint", locale)).toContain("/datenschutz");
  });

  it.each(LEGAL_LOCALES)(
    "privacy/%s links to the imprint and describes what the app does",
    (locale) => {
      expect(renderLinks("privacy", locale)).toContain("/impressum");
      const text = renderText("privacy", locale);
      expect(text).toContain("GitHub Pages");
      expect(text).toContain("IndexedDB");
      expect(text).toMatch(/Anthropic/);
      expect(text).toMatch(/Perplexity/);
    },
  );

  it("opens every external link in a new tab with rel noopener", () => {
    for (const [kind, locale] of combos) {
      const { Content } = getLegalDocument(kind, locale);
      const { container } = render(
        <MemoryRouter>
          <Content />
        </MemoryRouter>,
      );
      for (const anchor of container.querySelectorAll("a[href^='http']")) {
        expect(
          anchor.getAttribute("target"),
          anchor.getAttribute("href") ?? "",
        ).toBe("_blank");
        expect(anchor.getAttribute("rel") ?? "").toContain("noopener");
      }
    }
  });
});

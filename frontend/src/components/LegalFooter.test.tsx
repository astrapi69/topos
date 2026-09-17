import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ lang: "de" }));
vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: i18n.lang,
  }),
}));

import LegalFooter from "./LegalFooter";

describe("LegalFooter", () => {
  it("links to the German static pages when the UI language is German", () => {
    i18n.lang = "de";
    render(<LegalFooter />);
    expect(screen.getByTestId("legal-footer-imprint")).toHaveAttribute(
      "href",
      "/impressum.html",
    );
    expect(screen.getByTestId("legal-footer-privacy")).toHaveAttribute(
      "href",
      "/datenschutz.html",
    );
  });

  it("links to the English pages for any other language", () => {
    i18n.lang = "fr";
    render(<LegalFooter />);
    expect(screen.getByTestId("legal-footer-imprint")).toHaveAttribute(
      "href",
      "/imprint.html",
    );
    expect(screen.getByTestId("legal-footer-privacy")).toHaveAttribute(
      "href",
      "/privacy.html",
    );
  });

  it("is a footer landmark with exactly the two legal links", () => {
    i18n.lang = "de";
    render(<LegalFooter />);
    const footer = screen.getByTestId("legal-footer");
    expect(footer.tagName).toBe("FOOTER");
    expect(footer.querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByTestId("legal-footer-imprint").textContent).toBe(
      "Impressum",
    );
    expect(screen.getByTestId("legal-footer-privacy").textContent).toBe(
      "Datenschutzerklärung",
    );
  });
});

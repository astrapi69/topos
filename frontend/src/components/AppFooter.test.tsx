import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AppFooter from "./AppFooter";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "de",
  }),
}));

describe("AppFooter", () => {
  it("links to the imprint and the privacy policy as in-app routes", () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("app-footer")).toBeInTheDocument();
    expect(screen.getByTestId("footer-imprint-link")).toHaveAttribute(
      "href",
      "/impressum",
    );
    expect(screen.getByTestId("footer-privacy-link")).toHaveAttribute(
      "href",
      "/datenschutz",
    );
  });

  it("uses the i18n labels", () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("footer-imprint-link").textContent).toBe(
      "Impressum",
    );
    expect(screen.getByTestId("footer-privacy-link").textContent).toBe(
      "Datenschutz",
    );
  });
});

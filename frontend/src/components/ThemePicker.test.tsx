import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import ThemePicker from "./ThemePicker";
import { THEMES } from "../themes/themes";

// i18n mocked to the English fallbacks so labels render without a backend.
vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
  }),
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-app-theme");
});

describe("ThemePicker", () => {
  it("renders a radio option for every registered theme", () => {
    render(<ThemePicker />);
    for (const theme of THEMES) {
      expect(
        screen.getByTestId(`theme-option-${theme.id}`),
      ).toBeInTheDocument();
    }
  });

  it("marks the active theme's radio as checked (light default)", () => {
    render(<ThemePicker />);
    const lightRadio = within(
      screen.getByTestId("theme-option-light"),
    ).getByRole("radio");
    expect(lightRadio).toBeChecked();
  });

  it("selecting a theme applies data-app-theme + data-theme family", () => {
    render(<ThemePicker />);
    const hcRadio = within(
      screen.getByTestId("theme-option-high-contrast"),
    ).getByRole("radio");
    fireEvent.click(hcRadio);
    expect(document.documentElement.getAttribute("data-app-theme")).toBe(
      "high-contrast",
    );
    // high-contrast is a dark-family theme.
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("topos-app-theme")).toBe("high-contrast");
  });
});

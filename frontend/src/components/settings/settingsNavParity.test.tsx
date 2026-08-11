/**
 * Both Settings navigation surfaces render from ONE model.
 *
 * Desktop and mobile are separate components, so nothing but a test
 * stops one from gaining a tab the other lacks. This renders both from
 * the same fixture and pins that they expose the same set of item
 * values - keyed on `value`, the one field both consume (the testids
 * differ by design).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsSidebar from "./SettingsSidebar";
import SettingsMobileMenu from "./SettingsMobileMenu";
import { navValues, resolveTab } from "../../settings/sidebarModel";
import type { SidebarGroup } from "../../settings/sidebarModel";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "de",
    setLang: vi.fn(),
  }),
}));

const GROUPS: SidebarGroup[] = [
  {
    key: "app",
    label: "App",
    items: [
      { value: "general", label: "Allgemein", testId: "settings-tab-general" },
      { value: "data", label: "Daten", testId: "settings-tab-data" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [{ value: "about", label: "Über", testId: "settings-tab-about" }],
  },
];

describe("settings navigation parity", () => {
  it("exposes the same tabs on both surfaces", () => {
    const desktop = render(
      <SettingsSidebar
        groups={GROUPS}
        activeTab="general"
        onChange={vi.fn()}
      />,
    );
    const desktopValues = GROUPS.flatMap((group) => group.items)
      .filter((item) => desktop.queryByTestId(item.testId) !== null)
      .map((item) => item.value);
    desktop.unmount();

    const mobile = render(
      <SettingsMobileMenu
        groups={GROUPS}
        activeTab="general"
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    const mobileValues = navValues(GROUPS).filter(
      (value) => mobile.queryByTestId(`settings-mobile-tab-${value}`) !== null,
    );

    // Non-vacuity: an empty match on both sides would "pass" trivially.
    expect(desktopValues.length).toBe(navValues(GROUPS).length);
    expect(mobileValues).toEqual(desktopValues);
  });
});

describe("SettingsSidebar", () => {
  it("marks the active item for assistive technology", () => {
    render(
      <SettingsSidebar groups={GROUPS} activeTab="data" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("settings-tab-data")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("settings-tab-general")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("reports the picked tab", () => {
    const onChange = vi.fn();
    render(
      <SettingsSidebar
        groups={GROUPS}
        activeTab="general"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("settings-tab-about"));
    expect(onChange).toHaveBeenCalledWith("about");
  });

  it("renders a header per group", () => {
    render(
      <SettingsSidebar
        groups={GROUPS}
        activeTab="general"
        onChange={vi.fn()}
      />,
    );
    expect(
      within(screen.getByTestId("settings-group-app")).getByText("App"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("settings-group-system")).toBeInTheDocument();
  });
});

describe("SettingsMobileMenu", () => {
  it("shows the active label on the trigger and opens on click", () => {
    render(
      <SettingsMobileMenu
        groups={GROUPS}
        activeTab="data"
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByTestId("settings-mobile-trigger");
    expect(trigger).toHaveTextContent("Daten");
    expect(
      screen.queryByTestId("settings-mobile-menu"),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId("settings-mobile-menu")).toBeInTheDocument();
  });

  it("closes after picking a tab", () => {
    const onChange = vi.fn();
    render(
      <SettingsMobileMenu
        groups={GROUPS}
        activeTab="general"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    fireEvent.click(screen.getByTestId("settings-mobile-tab-about"));

    expect(onChange).toHaveBeenCalledWith("about");
    expect(
      screen.queryByTestId("settings-mobile-menu"),
    ).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(
      <SettingsMobileMenu
        groups={GROUPS}
        activeTab="general"
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByTestId("settings-mobile-menu"),
    ).not.toBeInTheDocument();
  });
});

describe("resolveTab", () => {
  it("falls back to the first tab for an unknown request", () => {
    expect(resolveTab(GROUPS, "does-not-exist")).toBe("general");
    expect(resolveTab(GROUPS, null)).toBe("general");
  });

  it("keeps a known request", () => {
    expect(resolveTab(GROUPS, "about")).toBe("about");
  });
});

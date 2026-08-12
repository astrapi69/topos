/**
 * The install affordance used to live only in Settings > About, three
 * clicks deep - the one place nobody looks for "install this app". iOS
 * got a global hint via IosInstallHint; the platforms that actually fire
 * `beforeinstallprompt` (Android Chrome, desktop Chromium) got nothing at
 * the top level. This banner closes that asymmetry.
 *
 * Pins: it stays invisible until the browser says installing is possible,
 * it prompts on click, and a dismissal sticks across mounts (an install
 * nag that returns on every load is worse than none).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InstallBanner from "./InstallBanner";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "de",
    setLang: vi.fn(),
  }),
}));

interface FakePromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Fire a `beforeinstallprompt` the way Chrome does, with a prompt(). */
function fireInstallPrompt(prompt = vi.fn(async () => {})): FakePromptEvent {
  const evt = new Event("beforeinstallprompt") as FakePromptEvent;
  evt.prompt = prompt;
  window.dispatchEvent(evt);
  return evt;
}

describe("InstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders nothing before the browser offers an install", () => {
    render(<InstallBanner />);
    expect(screen.queryByTestId("install-banner")).toBeNull();
  });

  it("appears once beforeinstallprompt fires", async () => {
    render(<InstallBanner />);
    fireInstallPrompt();
    expect(await screen.findByTestId("install-banner")).toBeTruthy();
  });

  it("prompts the browser when the install button is clicked", async () => {
    const prompt = vi.fn(async () => {});
    render(<InstallBanner />);
    fireInstallPrompt(prompt);

    fireEvent.click(await screen.findByTestId("install-banner-action"));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });

  it("stays dismissed across a remount", async () => {
    const first = render(<InstallBanner />);
    fireInstallPrompt();
    fireEvent.click(await screen.findByTestId("install-banner-dismiss"));
    await waitFor(() =>
      expect(screen.queryByTestId("install-banner")).toBeNull(),
    );
    first.unmount();

    render(<InstallBanner />);
    fireInstallPrompt();
    // A fresh event must not resurrect a banner the user closed.
    await waitFor(() =>
      expect(screen.queryByTestId("install-banner")).toBeNull(),
    );
  });

  it("disappears after the app reports itself installed", async () => {
    render(<InstallBanner />);
    fireInstallPrompt();
    expect(await screen.findByTestId("install-banner")).toBeTruthy();

    window.dispatchEvent(new Event("appinstalled"));
    await waitFor(() =>
      expect(screen.queryByTestId("install-banner")).toBeNull(),
    );
  });
});

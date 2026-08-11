/**
 * Language switching without a backend.
 *
 * The catalogs used to come only from `GET /api/i18n/{lang}`, so in the
 * static PWA every string fell back to its inline German default and
 * picking another language changed nothing but the select. The build
 * now bundles the catalogs (generated from the backend YAML), so a
 * switch works offline - and the choice survives a reload.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider, useI18n } from "./useI18n";

vi.mock("../api/client", () => ({
  api: {
    i18n: { get: vi.fn(async () => ({})) },
    settings: { getApp: vi.fn(async () => ({})) },
  },
  ApiError: class extends Error {},
}));

// No backend: the bundled catalogs are the only source.
vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: vi.fn(async () => false),
  _resetBackendProbe: vi.fn(),
}));

function Probe() {
  const { t, lang, setLang } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="title">
        {t("topos.page.settings.title", "FALLBACK")}
      </span>
      <button type="button" onClick={() => setLang("en")} data-testid="to-en">
        en
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("language switching without a backend", () => {
  it("renders the bundled German catalog by default", async () => {
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId("title")).toHaveTextContent("Einstellungen"),
    );
  });

  it("switches to the bundled English catalog", async () => {
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId("title")).toHaveTextContent("Einstellungen"),
    );

    await act(async () => {
      screen.getByTestId("to-en").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("title")).toHaveTextContent("Settings"),
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });

  it("remembers the choice across a remount", async () => {
    const first = renderProbe();
    await act(async () => {
      screen.getByTestId("to-en").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("title")).toHaveTextContent("Settings"),
    );
    first.unmount();

    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId("title")).toHaveTextContent("Settings"),
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });
});

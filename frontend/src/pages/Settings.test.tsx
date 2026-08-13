import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import { TestFeatureProvider } from "../features/testFeatureProvider";
import { DialogProvider } from "../components/AppDialog";
import AppUpdateProvider from "../components/AppUpdateProvider";

const mockGetSecretSource = vi.fn();

vi.mock("../api/client", () => ({
  api: {
    containers: { list: vi.fn().mockResolvedValue([]) },
    items: { list: vi.fn().mockResolvedValue([]) },
    categories: {
      list: vi.fn().mockResolvedValue([]),
      // Reject -> the OrphanPathsSection hides itself, keeping the
      // page shape these tests assert against.
      orphans: vi.fn().mockRejectedValue(new Error("offline")),
    },
    actions: { list: vi.fn().mockResolvedValue([]) },
    i18n: { get: vi.fn().mockResolvedValue({}) },
    settings: {
      getApp: vi.fn().mockResolvedValue({}),
      getSecretSource: (...args: unknown[]) => mockGetSecretSource(...args),
      getAiProviders: vi.fn().mockResolvedValue([]),
      getAiKeyStatus: vi.fn().mockResolvedValue([]),
      updateApp: vi.fn().mockResolvedValue({}),
      testAiConnection: vi
        .fn()
        .mockResolvedValue({ ok: true, errorCode: null }),
    },
  },
  ApiError: class extends Error {},
}));

// These tests exercise backend mode (the secret-source card + AI panel read
// the backend), so the health probe reports a reachable backend.
vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: () => Promise.resolve(true),
}));

/** Open the application-key tab; it appears only once the backend answers. */
async function openSecurityTab() {
  const tab = await screen.findByTestId("settings-tab-security");
  fireEvent.click(tab);
}

function renderSettings() {
  // AppUpdateProvider supplies the PwaUpdateProvider context the About
  // section's VersionCard reads; TestFeatureProvider the feature registry
  // DataSection's excel-import dispatch reads.
  return render(
    <MemoryRouter>
      <TestFeatureProvider>
        <AppUpdateProvider>
          <DialogProvider>
            <Settings />
          </DialogProvider>
        </AppUpdateProvider>
      </TestFeatureProvider>
    </MemoryRouter>,
  );
}

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecretSource.mockResolvedValue({
      source: "app_yaml",
      path: null,
      envVar: "TOPOS_SECRET_KEY",
      secretsYamlPath: "/tmp/.config/topos/secrets.yaml",
    });
  });

  it("opens on the general tab with language and theme", () => {
    renderSettings();
    expect(screen.getByTestId("settings-title")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("settings-language-select")).toBeInTheDocument();
    expect(screen.getByTestId("theme-picker")).toBeInTheDocument();
    // Only the active panel renders - the rest is one click away.
    expect(screen.queryByTestId("about-section")).not.toBeInTheDocument();
  });

  it("drops the backend tab where its panel would be empty", () => {
    // BackendUrlSettings hides itself under a subpath deploy (GitHub
    // Pages): an HTTPS PWA cannot reach a cross-origin http backend, so
    // configuring one is useless there. The tab has to go with it -
    // absent, not an empty panel.
    vi.stubEnv("BASE_URL", "/topos/");
    renderSettings();
    expect(
      screen.queryByTestId("settings-tab-backend"),
    ).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("keeps the backend tab on a root deploy", () => {
    vi.stubEnv("BASE_URL", "/");
    renderSettings();
    expect(screen.getByTestId("settings-tab-backend")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("switches panels when a sidebar tab is picked", () => {
    renderSettings();
    fireEvent.click(screen.getByTestId("settings-tab-about"));
    expect(screen.getByTestId("about-section")).toBeInTheDocument();
    expect(
      screen.queryByTestId("settings-language-select"),
    ).not.toBeInTheDocument();
  });

  it("keeps the cache reset on the maintenance tab", () => {
    renderSettings();
    fireEvent.click(screen.getByTestId("settings-tab-maintenance"));
    expect(screen.getByTestId("settings-reset-cache")).toBeInTheDocument();
  });

  it("restores the tab from the URL", () => {
    render(
      <MemoryRouter initialEntries={["/settings?tab=data"]}>
        <TestFeatureProvider>
          <AppUpdateProvider>
            <DialogProvider>
              <Settings />
            </DialogProvider>
          </AppUpdateProvider>
        </TestFeatureProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("data-export")).toBeInTheDocument();
  });

  it("falls back to the first tab for an unknown ?tab=", () => {
    render(
      <MemoryRouter initialEntries={["/settings?tab=nonsense"]}>
        <AppUpdateProvider>
          <DialogProvider>
            <Settings />
          </DialogProvider>
        </AppUpdateProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("settings-language-select")).toBeInTheDocument();
  });

  it("renders the secret-source label when the endpoint resolves", async () => {
    renderSettings();
    await openSecurityTab();
    expect(
      screen.getByTestId("settings-secret-source-label"),
    ).toBeInTheDocument();
  });

  it("shows the external-management hint when source is secrets_yaml", async () => {
    mockGetSecretSource.mockResolvedValue({
      source: "secrets_yaml",
      path: "/home/user/.config/topos/secrets.yaml",
      envVar: "TOPOS_SECRET_KEY",
      secretsYamlPath: "/home/user/.config/topos/secrets.yaml",
    });
    renderSettings();
    await openSecurityTab();
    expect(
      screen.getByTestId("settings-secret-source-hint").textContent,
    ).toContain("/home/user/.config/topos/secrets.yaml");
  });

  it("shows the env-var name in the hint when source is env", async () => {
    mockGetSecretSource.mockResolvedValue({
      source: "env",
      path: null,
      envVar: "TOPOS_SECRET_KEY",
      secretsYamlPath: "/home/user/.config/topos/secrets.yaml",
    });
    renderSettings();
    await openSecurityTab();
    expect(
      screen.getByTestId("settings-secret-source-hint").textContent,
    ).toContain("$TOPOS_SECRET_KEY");
  });

  it("hides the secret-source card when the endpoint rejects", async () => {
    mockGetSecretSource.mockRejectedValue(new Error("offline"));
    renderSettings();
    // Wait for the rejection to settle: without a key there is no tab to
    // open at all (absent, not greyed out).
    await new Promise((r) => setTimeout(r, 30));
    expect(
      screen.queryByTestId("settings-tab-security"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("settings-secret-source-label"),
    ).not.toBeInTheDocument();
  });
});

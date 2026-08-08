import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshApiKeyStatus } from "@astrapi69/ai-key-vault-react";

import AiProviderSettings, { VaultPassphraseForm } from "./AiProviderSettings";
import { notify } from "../utils/notify";
import { createBackendAdapter } from "../ai/backendAdapter";
import { TOPOS_REGISTRY } from "../ai/registry";
import * as vault from "../ai/localVaultStore";

const mockGetApp = vi.fn();
const mockGetKeyStatus = vi.fn();
const mockUpdateApp = vi.fn();
const mockTest = vi.fn();

// Preserve ApiError + types; only the settings network calls are faked.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      settings: {
        ...actual.api.settings,
        getApp: () => mockGetApp(),
        getAiKeyStatus: () => mockGetKeyStatus(),
        updateApp: (patch: unknown) => mockUpdateApp(patch),
        testAiConnection: (body: unknown) => mockTest(body),
      },
    },
  };
});

const mockBackendAvailable = vi.fn();
vi.mock("../utils/backendStatus", () => ({
  isBackendAvailable: () => mockBackendAvailable(),
}));

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

const mockConfirm = vi.fn(async () => true);
vi.mock("./AppDialog", () => ({
  useDialog: () => ({
    confirm: mockConfirm,
    prompt: vi.fn(),
    alert: vi.fn(),
    choose: vi.fn(),
  }),
}));

vi.mock("../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  errorMessage: (_e: unknown, fb: string) => fb,
}));

function keyStatuses() {
  return ["anthropic", "openai", "google"].map((provider) => ({
    provider,
    configured: false,
    source: "none",
    externallyManaged: false,
  }));
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <AiProviderSettings />
    </MemoryRouter>,
  );
}

const PASS = "correct horse battery";

describe("AiProviderSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vault._resetSessionForTest();
    mockBackendAvailable.mockResolvedValue(true);
    mockGetApp.mockResolvedValue({
      ai: {
        enabled: false,
        activeProvider: "anthropic",
        models: {},
        baseUrls: {},
      },
    });
    mockGetKeyStatus.mockResolvedValue(keyStatuses());
    mockUpdateApp.mockResolvedValue({});
    mockTest.mockResolvedValue({ ok: true, errorCode: null });
    mockConfirm.mockResolvedValue(true);
  });

  it("renders the packaged AI settings panel in backend mode", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("ai-settings-section")).toBeInTheDocument();
    });
    expect(await screen.findByTestId("settings-panel-ai")).toBeInTheDocument();
    // Backend mode has no encrypted vault section and no unlock gate.
    expect(
      screen.queryByTestId("ai-vault-create-pass"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("key-vault-section")).not.toBeInTheDocument();
    // The custom base-URL field only shows when custom is active.
    expect(screen.queryByTestId("ai-custom-base-url")).not.toBeInTheDocument();
  });

  it("shows the custom base-URL field when custom is the active provider", async () => {
    mockGetApp.mockResolvedValue({
      ai: { enabled: true, activeProvider: "custom", models: {}, baseUrls: {} },
    });
    // useApiKeyStatus caches per-userId across tests; prime it with the
    // custom snapshot so the active provider is "custom" on mount.
    await refreshApiKeyStatus(createBackendAdapter(), TOPOS_REGISTRY, "topos");
    renderPanel();
    const input = await screen.findByTestId("ai-custom-base-url");
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "http://localhost:1234/v1" } });
    fireEvent.click(screen.getByTestId("ai-custom-base-url-save"));
    await waitFor(() => {
      expect(mockUpdateApp).toHaveBeenCalledWith({
        ai: { baseUrls: { custom: "http://localhost:1234/v1" } },
      });
    });
  });

  it("persists the enable flag to the backend", async () => {
    renderPanel();
    await waitFor(() => screen.getByTestId("ai-enable-toggle"));
    fireEvent.click(screen.getByTestId("ai-enable-toggle"));
    await waitFor(() => {
      expect(mockUpdateApp).toHaveBeenCalledWith({ ai: { enabled: true } });
    });
  });

  it("shows the provider panel immediately in local mode - no passphrase wall", async () => {
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    await waitFor(() => screen.getByTestId("ai-settings-local-hint"));
    // The packaged provider panel is visible with no vault created.
    expect(await screen.findByTestId("settings-panel-ai")).toBeInTheDocument();
    // No passphrase prompt is shown until a key is actually saved.
    expect(screen.queryByTestId("ai-vault-prompt")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-vault-create-pass"),
    ).not.toBeInTheDocument();
    // No unlock CTA either, because no vault exists yet.
    expect(screen.queryByTestId("ai-vault-unlock-cta")).not.toBeInTheDocument();
    // The encrypted key-import entry point IS available so a fresh device can
    // bootstrap its keys from an exported .alk file.
    expect(screen.getByTestId("ai-key-import")).toBeInTheDocument();
  });

  it("offers an unlock CTA for an existing locked vault and unlocks via the prompt", async () => {
    await vault.createVault(PASS);
    vault.lock();
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    // Panel stays visible; the CTA does not block it.
    expect(await screen.findByTestId("settings-panel-ai")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("ai-vault-unlock-cta"));

    fireEvent.change(await screen.findByTestId("ai-vault-unlock-pass"), {
      target: { value: PASS },
    });
    fireEvent.click(screen.getByTestId("ai-vault-unlock-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-vault-lock-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("key-vault-section")).toBeInTheDocument();
    // Once unlocked the full section (with export) replaces the standalone
    // import entry point.
    expect(screen.queryByTestId("ai-key-import")).not.toBeInTheDocument();
    expect(vault.isUnlocked()).toBe(true);
  });

  it("reports a wrong passphrase in the unlock prompt and stays locked", async () => {
    await vault.createVault(PASS);
    vault.lock();
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    fireEvent.click(await screen.findByTestId("ai-vault-unlock-cta"));
    fireEvent.change(await screen.findByTestId("ai-vault-unlock-pass"), {
      target: { value: "wrong passphrase" },
    });
    fireEvent.click(screen.getByTestId("ai-vault-unlock-button"));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    expect(
      screen.queryByTestId("ai-vault-lock-button"),
    ).not.toBeInTheDocument();
    expect(vault.isUnlocked()).toBe(false);
  });

  it("locks the vault again on demand", async () => {
    await vault.createVault(PASS); // starts unlocked
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    await waitFor(() => screen.getByTestId("ai-vault-lock-button"));

    fireEvent.click(screen.getByTestId("ai-vault-lock-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-vault-unlock-cta")).toBeInTheDocument();
    });
    expect(vault.isUnlocked()).toBe(false);
  });

  it("persists the enable flag to the local vault metadata", async () => {
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    await waitFor(() => screen.getByTestId("ai-enable-toggle"));
    fireEvent.click(screen.getByTestId("ai-enable-toggle"));
    await waitFor(() => expect(vault.isEnabled()).toBe(true));
  });

  it("closes the unlock prompt on cancel without unlocking", async () => {
    await vault.createVault(PASS);
    vault.lock();
    mockBackendAvailable.mockResolvedValue(false);
    renderPanel();
    fireEvent.click(await screen.findByTestId("ai-vault-unlock-cta"));
    expect(await screen.findByTestId("ai-vault-prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ai-vault-cancel-button"));
    await waitFor(() =>
      expect(screen.queryByTestId("ai-vault-prompt")).not.toBeInTheDocument(),
    );
    expect(vault.isUnlocked()).toBe(false);
  });
});

describe("VaultPassphraseForm (create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vault._resetSessionForTest();
  });

  function renderCreate() {
    const onReady = vi.fn();
    const onCancel = vi.fn();
    render(
      <MemoryRouter>
        <VaultPassphraseForm
          kind="create"
          onReady={onReady}
          onCancel={onCancel}
        />
      </MemoryRouter>,
    );
    return { onReady, onCancel };
  }

  it("rejects mismatched passphrases without creating a vault", async () => {
    const { onReady } = renderCreate();
    fireEvent.change(screen.getByTestId("ai-vault-create-pass"), {
      target: { value: PASS },
    });
    fireEvent.change(screen.getByTestId("ai-vault-create-confirm"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByTestId("ai-vault-create-button"));
    await waitFor(() => expect(notify.warning).toHaveBeenCalled());
    expect(vault.hasVault()).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("rejects a too-short passphrase", async () => {
    const { onReady } = renderCreate();
    fireEvent.change(screen.getByTestId("ai-vault-create-pass"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByTestId("ai-vault-create-confirm"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByTestId("ai-vault-create-button"));
    await waitFor(() => expect(notify.warning).toHaveBeenCalled());
    expect(vault.hasVault()).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("creates the vault on matching passphrases", async () => {
    const { onReady } = renderCreate();
    fireEvent.change(screen.getByTestId("ai-vault-create-pass"), {
      target: { value: PASS },
    });
    fireEvent.change(screen.getByTestId("ai-vault-create-confirm"), {
      target: { value: PASS },
    });
    fireEvent.click(screen.getByTestId("ai-vault-create-button"));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(vault.hasVault()).toBe(true);
    expect(vault.isUnlocked()).toBe(true);
  });
});

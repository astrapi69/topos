import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {refreshApiKeyStatus} from "@astrapi69/ai-key-vault-react";

import AiProviderSettings from "./AiProviderSettings";
import {notify} from "../utils/notify";
import {createBackendAdapter} from "../ai/backendAdapter";
import {TOPOS_REGISTRY} from "../ai/registry";
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
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k}),
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
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()},
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

async function fillCreateGate() {
    fireEvent.change(screen.getByTestId("ai-vault-create-pass"), {target: {value: PASS}});
    fireEvent.change(screen.getByTestId("ai-vault-create-confirm"), {target: {value: PASS}});
    fireEvent.click(screen.getByTestId("ai-vault-create-button"));
}

describe("AiProviderSettings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vault._resetSessionForTest();
        mockBackendAvailable.mockResolvedValue(true);
        mockGetApp.mockResolvedValue({
            ai: {enabled: false, activeProvider: "anthropic", models: {}, baseUrls: {}},
        });
        mockGetKeyStatus.mockResolvedValue(keyStatuses());
        mockUpdateApp.mockResolvedValue({});
        mockTest.mockResolvedValue({ok: true, errorCode: null});
        mockConfirm.mockResolvedValue(true);
    });

    it("renders the packaged AI settings panel in backend mode", async () => {
        renderPanel();
        await waitFor(() => {
            expect(screen.getByTestId("ai-settings-section")).toBeInTheDocument();
        });
        expect(await screen.findByTestId("settings-panel-ai")).toBeInTheDocument();
        // Backend mode has no encrypted vault section and no unlock gate.
        expect(screen.queryByTestId("ai-vault-create-pass")).not.toBeInTheDocument();
        expect(screen.queryByTestId("key-vault-section")).not.toBeInTheDocument();
        // The custom base-URL field only shows when custom is active.
        expect(screen.queryByTestId("ai-custom-base-url")).not.toBeInTheDocument();
    });

    it("shows the custom base-URL field when custom is the active provider", async () => {
        mockGetApp.mockResolvedValue({
            ai: {enabled: true, activeProvider: "custom", models: {}, baseUrls: {}},
        });
        // useApiKeyStatus caches per-userId across tests; prime it with the
        // custom snapshot so the active provider is "custom" on mount.
        await refreshApiKeyStatus(createBackendAdapter(), TOPOS_REGISTRY, "topos");
        renderPanel();
        const input = await screen.findByTestId("ai-custom-base-url");
        expect(input).toBeInTheDocument();
        fireEvent.change(input, {target: {value: "http://localhost:1234/v1"}});
        fireEvent.click(screen.getByTestId("ai-custom-base-url-save"));
        await waitFor(() => {
            expect(mockUpdateApp).toHaveBeenCalledWith({
                ai: {baseUrls: {custom: "http://localhost:1234/v1"}},
            });
        });
    });

    it("persists the enable flag to the backend", async () => {
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-enable-toggle"));
        fireEvent.click(screen.getByTestId("ai-enable-toggle"));
        await waitFor(() => {
            expect(mockUpdateApp).toHaveBeenCalledWith({ai: {enabled: true}});
        });
    });

    it("shows the create-passphrase gate in local mode with no vault", async () => {
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-settings-local-hint"));
        expect(screen.getByTestId("ai-vault-create-pass")).toBeInTheDocument();
        // The panel is not shown until the vault is unlocked.
        expect(screen.queryByTestId("settings-panel-ai")).not.toBeInTheDocument();
    });

    it("creates the vault and reveals the panel + encrypted key vault", async () => {
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-vault-create-pass"));
        await fillCreateGate();

        await waitFor(() => {
            expect(screen.getByTestId("ai-vault-lock-button")).toBeInTheDocument();
        });
        expect(await screen.findByTestId("settings-panel-ai")).toBeInTheDocument();
        expect(screen.getByTestId("key-vault-section")).toBeInTheDocument();
        expect(vault.hasVault()).toBe(true);
        expect(vault.isUnlocked()).toBe(true);
    });

    it("rejects mismatched passphrases without creating a vault", async () => {
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-vault-create-pass"));
        fireEvent.change(screen.getByTestId("ai-vault-create-pass"), {target: {value: PASS}});
        fireEvent.change(screen.getByTestId("ai-vault-create-confirm"), {
            target: {value: "different"},
        });
        fireEvent.click(screen.getByTestId("ai-vault-create-button"));
        await waitFor(() => expect(notify.warning).toHaveBeenCalled());
        expect(vault.hasVault()).toBe(false);
    });

    it("unlocks an existing vault with the correct passphrase", async () => {
        await vault.createVault(PASS);
        vault.lock();
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-vault-unlock-pass"));
        fireEvent.change(screen.getByTestId("ai-vault-unlock-pass"), {target: {value: PASS}});
        fireEvent.click(screen.getByTestId("ai-vault-unlock-button"));
        await waitFor(() => {
            expect(screen.getByTestId("ai-vault-lock-button")).toBeInTheDocument();
        });
    });

    it("reports a wrong passphrase and stays locked", async () => {
        await vault.createVault(PASS);
        vault.lock();
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-vault-unlock-pass"));
        fireEvent.change(screen.getByTestId("ai-vault-unlock-pass"), {
            target: {value: "wrong passphrase"},
        });
        fireEvent.click(screen.getByTestId("ai-vault-unlock-button"));
        await waitFor(() => expect(notify.error).toHaveBeenCalled());
        expect(screen.queryByTestId("ai-vault-lock-button")).not.toBeInTheDocument();
    });

    it("locks the vault again on demand", async () => {
        mockBackendAvailable.mockResolvedValue(false);
        renderPanel();
        await waitFor(() => screen.getByTestId("ai-vault-create-pass"));
        await fillCreateGate();
        await waitFor(() => screen.getByTestId("ai-vault-lock-button"));

        fireEvent.click(screen.getByTestId("ai-vault-lock-button"));
        await waitFor(() => {
            expect(screen.getByTestId("ai-vault-unlock-pass")).toBeInTheDocument();
        });
        expect(vault.isUnlocked()).toBe(false);
    });
});

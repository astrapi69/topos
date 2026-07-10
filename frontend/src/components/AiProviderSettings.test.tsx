import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import AiProviderSettings from "./AiProviderSettings";
import {notify} from "../utils/notify";

const mockGetProviders = vi.fn();
const mockGetKeyStatus = vi.fn();
const mockGetApp = vi.fn();
const mockUpdateApp = vi.fn();
const mockTest = vi.fn();

vi.mock("../api/client", () => ({
    api: {
        settings: {
            getAiProviders: () => mockGetProviders(),
            getAiKeyStatus: () => mockGetKeyStatus(),
            getApp: () => mockGetApp(),
            updateApp: (patch: unknown) => mockUpdateApp(patch),
            testAiConnection: (body: unknown) => mockTest(body),
        },
    },
}));

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k}),
}));

vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn()},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

const PROVIDERS = [
    {
        id: "anthropic",
        label: "Anthropic (Claude)",
        baseUrl: "https://api.anthropic.com/v1",
        defaultModel: "claude-sonnet-4-6",
        models: [{id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", vision: true}],
        envVar: "TOPOS_ANTHROPIC_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: false,
        note: "",
    },
    {
        id: "custom",
        label: "Custom (OpenAI-compatible)",
        baseUrl: "",
        defaultModel: "",
        models: [],
        envVar: "TOPOS_CUSTOM_API_KEY",
        requiresApiKey: true,
        requiresBaseUrl: true,
        note: "vision_depends_on_model",
    },
];

function statuses(overrides: Record<string, unknown> = {}) {
    return [
        {
            provider: "anthropic",
            configured: false,
            source: "none",
            externallyManaged: false,
            ...overrides,
        },
        {provider: "custom", configured: false, source: "none", externallyManaged: false},
    ];
}

describe("AiProviderSettings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // mockResolvedValue (not Once) survives React 18 strict double-mount.
        mockGetProviders.mockResolvedValue(PROVIDERS);
        mockGetKeyStatus.mockResolvedValue(statuses());
        mockGetApp.mockResolvedValue({
            ai: {enabled: false, activeProvider: "anthropic", models: {}, baseUrls: {}},
        });
        mockUpdateApp.mockResolvedValue({});
        mockTest.mockResolvedValue({ok: true, errorCode: null});
    });

    it("renders the provider, model and key controls after load", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => {
            expect(screen.getByTestId("ai-settings-section")).toBeInTheDocument();
        });
        expect(screen.getByTestId("ai-provider-select")).toBeInTheDocument();
        expect(screen.getByTestId("ai-model-select")).toBeInTheDocument();
        expect(screen.getByTestId("ai-key-input")).toBeInTheDocument();
        expect(screen.getByTestId("ai-save-button")).toBeInTheDocument();
        expect(screen.getByTestId("ai-test-button")).toBeInTheDocument();
    });

    it("marks vision-capable models in the dropdown", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-model-select"));
        expect(screen.getByText(/Claude Sonnet 4.6 - Vision/)).toBeInTheDocument();
    });

    it("shows an offline hint instead of the controls when the endpoints are unreachable", async () => {
        mockGetProviders.mockRejectedValue(new Error("offline"));
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-settings-offline-hint"));
        // The section stays visible (a silently missing section reads
        // as "feature does not exist"), only the controls are gone.
        expect(screen.getByTestId("ai-settings-section")).toBeInTheDocument();
        expect(screen.queryByTestId("ai-enable-toggle")).not.toBeInTheDocument();
        expect(screen.queryByTestId("ai-provider-select")).not.toBeInTheDocument();
        expect(screen.queryByTestId("ai-save-button")).not.toBeInTheDocument();
    });

    it("shows a read-only source card for an externally-managed key", async () => {
        mockGetKeyStatus.mockResolvedValue(
            statuses({source: "env", externallyManaged: true, configured: true}),
        );
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-settings-section"));
        expect(screen.getByTestId("ai-key-source")).toBeInTheDocument();
        expect(screen.queryByTestId("ai-key-input")).not.toBeInTheDocument();
    });

    it("shows base-url and free-text model inputs for the custom provider", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-provider-select"));
        fireEvent.change(screen.getByTestId("ai-provider-select"), {
            target: {value: "custom"},
        });
        expect(screen.getByTestId("ai-base-url-input")).toBeInTheDocument();
        expect(screen.getByTestId("ai-model-input")).toBeInTheDocument();
        expect(screen.queryByTestId("ai-model-select")).not.toBeInTheDocument();
    });

    it("tests the connection and reports success", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-test-button"));
        fireEvent.click(screen.getByTestId("ai-test-button"));
        await waitFor(() => {
            expect(mockTest).toHaveBeenCalledWith(
                expect.objectContaining({provider: "anthropic"}),
            );
        });
        expect(notify.success).toHaveBeenCalled();
    });

    it("saves the typed key in the ai patch", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-key-input"));
        fireEvent.change(screen.getByTestId("ai-key-input"), {
            target: {value: "sk-typed"},
        });
        fireEvent.click(screen.getByTestId("ai-save-button"));
        await waitFor(() => {
            expect(mockUpdateApp).toHaveBeenCalled();
        });
        const patch = mockUpdateApp.mock.calls[0][0];
        expect(patch.ai.keys).toEqual({anthropic: "sk-typed"});
        expect(patch.ai.activeProvider).toBe("anthropic");
    });

    it("does not send a key when the field is empty", async () => {
        render(<AiProviderSettings />);
        await waitFor(() => screen.getByTestId("ai-save-button"));
        fireEvent.click(screen.getByTestId("ai-save-button"));
        await waitFor(() => expect(mockUpdateApp).toHaveBeenCalled());
        const patch = mockUpdateApp.mock.calls[0][0];
        expect(patch.ai.keys).toBeUndefined();
    });
});

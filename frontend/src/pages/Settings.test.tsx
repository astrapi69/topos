import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Settings from "./Settings";
import {DialogProvider} from "../components/AppDialog";

const mockGetSecretSource = vi.fn();

vi.mock("../api/client", () => ({
    api: {
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([])},
        categories: {list: vi.fn().mockResolvedValue([])},
        actions: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {
            getApp: vi.fn().mockResolvedValue({}),
            getSecretSource: (...args: unknown[]) => mockGetSecretSource(...args),
            getAiProviders: vi.fn().mockResolvedValue([]),
            getAiKeyStatus: vi.fn().mockResolvedValue([]),
            updateApp: vi.fn().mockResolvedValue({}),
            testAiConnection: vi.fn().mockResolvedValue({ok: true, errorCode: null}),
        },
    },
    ApiError: class extends Error {},
}));

// These tests exercise backend mode (the secret-source card + AI panel read
// the backend), so the health probe reports a reachable backend.
vi.mock("../utils/backendStatus", () => ({
    isBackendAvailable: () => Promise.resolve(true),
}));

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

    it("renders language, theme, and reset controls", () => {
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Settings />
                </DialogProvider>
            </MemoryRouter>,
        );
        expect(screen.getByTestId("settings-title")).toBeInTheDocument();
        expect(screen.getByTestId("settings-language-select")).toBeInTheDocument();
        expect(screen.getByTestId("settings-theme-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("settings-reset-cache")).toBeInTheDocument();
    });

    it("renders the secret-source label when the endpoint resolves", async () => {
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Settings />
                </DialogProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("settings-secret-source-label")).toBeInTheDocument();
        });
    });

    it("shows the external-management hint when source is secrets_yaml", async () => {
        mockGetSecretSource.mockResolvedValue({
            source: "secrets_yaml",
            path: "/home/user/.config/topos/secrets.yaml",
            envVar: "TOPOS_SECRET_KEY",
            secretsYamlPath: "/home/user/.config/topos/secrets.yaml",
        });
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Settings />
                </DialogProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("settings-secret-source-hint")).toBeInTheDocument();
        });
        expect(screen.getByTestId("settings-secret-source-hint").textContent).toContain(
            "/home/user/.config/topos/secrets.yaml",
        );
    });

    it("shows the env-var name in the hint when source is env", async () => {
        mockGetSecretSource.mockResolvedValue({
            source: "env",
            path: null,
            envVar: "TOPOS_SECRET_KEY",
            secretsYamlPath: "/home/user/.config/topos/secrets.yaml",
        });
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Settings />
                </DialogProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("settings-secret-source-hint").textContent).toContain(
                "$TOPOS_SECRET_KEY",
            );
        });
    });

    it("hides the secret-source card when the endpoint rejects", async () => {
        mockGetSecretSource.mockRejectedValue(new Error("offline"));
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Settings />
                </DialogProvider>
            </MemoryRouter>,
        );
        // Wait for the rejection to settle, then assert the card never appeared.
        await new Promise((r) => setTimeout(r, 30));
        expect(screen.queryByTestId("settings-secret-source-label")).not.toBeInTheDocument();
    });
});

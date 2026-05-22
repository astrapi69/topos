/**
 * Smoke test: Dashboard renders without crashing.
 */

import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Dashboard from "./Dashboard";

vi.mock("../api/client", () => ({
    api: {
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([]), search: vi.fn().mockResolvedValue([])},
        categories: {list: vi.fn().mockResolvedValue([])},
        actions: {list: vi.fn().mockResolvedValue([])},
        settings: {getApp: vi.fn().mockResolvedValue({})},
        i18n: {get: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("Dashboard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the title and the four stat tiles", async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("dashboard-title")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("stat-containers")).toBeInTheDocument();
            expect(screen.getByTestId("stat-items")).toBeInTheDocument();
            expect(screen.getByTestId("stat-categories")).toBeInTheDocument();
            expect(screen.getByTestId("stat-actions")).toBeInTheDocument();
        });
    });
});

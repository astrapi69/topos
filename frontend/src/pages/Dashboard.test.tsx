/**
 * Dashboard: smoke test + MiniSearch integration.
 */

import "fake-indexeddb/auto";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Dashboard from "./Dashboard";
import {db} from "../db/schema";

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

beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([db.containers.clear(), db.items.clear(), db.categories.clear(), db.actions.clear()]);
});

describe("Dashboard", () => {
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

    it("searches the cached data via MiniSearch and renders a hit", async () => {
        const {api} = await import("../api/client");
        vi.mocked(api.containers.list).mockResolvedValue([
            {
                id: 3,
                externalId: 1003,
                type: "folder",
                owner: "self",
                label: "Citibank Ordner",
                description: null,
                location: "Regal",
                sizeGroup: null,
                createdAt: "2026-01-01T00:00:00",
                updatedAt: "2026-01-01T00:00:00",
            },
        ]);
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>,
        );
        // Wait until the container is cached + indexed.
        await waitFor(() => expect(screen.getByTestId("stat-containers")).toHaveTextContent("1"));

        fireEvent.change(screen.getByTestId("dashboard-search-input"), {target: {value: "Citibank"}});

        await waitFor(
            () => expect(screen.getByTestId("search-hit-container-3")).toBeInTheDocument(),
            {timeout: 2000},
        );
        expect(screen.getByTestId("dashboard-search-count")).toHaveTextContent("1");
    });

    it("shows an empty state when nothing matches", async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>,
        );
        await screen.findByTestId("stat-containers");
        fireEvent.change(screen.getByTestId("dashboard-search-input"), {target: {value: "zzzznope"}});
        await waitFor(() => expect(screen.getByTestId("dashboard-search-empty")).toBeInTheDocument(), {
            timeout: 2000,
        });
    });
});

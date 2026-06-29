import "fake-indexeddb/auto";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import NavBar from "./NavBar";
import {db} from "../db/schema";

vi.mock("../api/client", () => ({
    api: {
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([])},
        actions: {list: vi.fn().mockResolvedValue([])},
        settings: {getApp: vi.fn().mockResolvedValue({})},
        i18n: {get: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([db.containers.clear(), db.items.clear(), db.actions.clear()]);
});

describe("NavBar global search", () => {
    it("renders the nav links and a search trigger", () => {
        render(
            <MemoryRouter>
                <NavBar />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
        expect(screen.getByTestId("nav-search")).toBeInTheDocument();
        // The spotlight is mounted only on open.
        expect(screen.queryByTestId("global-search-overlay")).not.toBeInTheDocument();
    });

    it("opens the spotlight and finds a cached container", async () => {
        const {api} = await import("../api/client");
        vi.mocked(api.containers.list).mockResolvedValue([
            {
                id: 4,
                externalId: 1004,
                type: "folder",
                owner: "self",
                label: "Sparda Bank Ordner",
                description: null,
                location: null,
                sizeGroup: null,
                createdAt: "2026-01-01T00:00:00",
                updatedAt: "2026-01-01T00:00:00",
            },
        ]);
        render(
            <MemoryRouter>
                <NavBar />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByTestId("nav-search"));
        expect(screen.getByTestId("global-search-overlay")).toBeInTheDocument();

        const inputEl = screen.getByTestId("global-search-input");
        fireEvent.change(inputEl, {target: {value: "Sparda"}});

        await waitFor(
            () => expect(screen.getByTestId("search-hit-container-4")).toBeInTheDocument(),
            {timeout: 2000},
        );
    });

    it("closes the spotlight on Escape", async () => {
        render(
            <MemoryRouter>
                <NavBar />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByTestId("nav-search"));
        expect(screen.getByTestId("global-search-overlay")).toBeInTheDocument();
        fireEvent.keyDown(window, {key: "Escape"});
        await waitFor(() =>
            expect(screen.queryByTestId("global-search-overlay")).not.toBeInTheDocument(),
        );
    });
});

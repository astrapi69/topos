import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import CategoryBrowse from "./CategoryBrowse";
import {db} from "../db/schema";

const treeMock = vi.fn();

vi.mock("../api/client", () => ({
    api: {
        categories: {
            tree: () => treeMock(),
        },
        items: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

const backendAvailableMock = vi.fn();
vi.mock("../utils/backendStatus", () => ({
    isBackendAvailable: () => backendAvailableMock(),
}));

async function seedCategory() {
    await db.categories.clear();
    await db.categories.bulkPut([
        {id: 1, path: "finance", parentPath: null, name: "finance", displayName: "Finanzen", level: 0},
    ]);
}

describe("CategoryBrowse", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        backendAvailableMock.mockResolvedValue(true);
        treeMock.mockResolvedValue([
            {path: "finance", name: "finance", displayName: "Finanzen", level: 0, children: []},
        ]);
        await db.categories.clear();
        await db.items.clear();
    });

    it("renders the tree from the API in backend mode", async () => {
        render(
            <MemoryRouter>
                <CategoryBrowse />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("category-browse-title")).toBeInTheDocument();
        expect(screen.getByTestId("category-tree")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
        });
        expect(treeMock).toHaveBeenCalled();
    });

    it("reads the tree from the Dexie cache in offline mode (no API call)", async () => {
        backendAvailableMock.mockResolvedValue(false);
        await seedCategory();
        render(
            <MemoryRouter>
                <CategoryBrowse />
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
        });
        // The API tree endpoint is never called offline.
        expect(treeMock).not.toHaveBeenCalled();
    });

    it("renders an empty tree offline when the cache is empty", async () => {
        backendAvailableMock.mockResolvedValue(false);
        render(
            <MemoryRouter>
                <CategoryBrowse />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("category-tree")).toBeInTheDocument();
        await waitFor(() => expect(backendAvailableMock).toHaveBeenCalled());
        expect(screen.queryByTestId("category-node-finance")).not.toBeInTheDocument();
        expect(treeMock).not.toHaveBeenCalled();
    });
});

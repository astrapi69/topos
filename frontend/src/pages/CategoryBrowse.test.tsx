import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import CategoryBrowse from "./CategoryBrowse";
import {db} from "../db/schema";
import {isBackendAvailable, _resetBackendProbe} from "../utils/backendStatus";
import {notify} from "../utils/notify";

vi.mock("../utils/backendStatus", () => ({
    isBackendAvailable: vi.fn(),
    _resetBackendProbe: vi.fn(),
}));

const treeMock = vi.fn();

vi.mock("../api/client", () => ({
    api: {
        categories: {
            tree: (...args: unknown[]) => treeMock(...args),
        },
        items: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

const backendAvailable = vi.mocked(isBackendAvailable);

describe("CategoryBrowse", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        _resetBackendProbe();
        await db.categories.clear();
        await db.items.clear();
    });

    afterEach(() => vi.restoreAllMocks());

    it("renders the tree from the backend in API mode", async () => {
        backendAvailable.mockResolvedValue(true);
        treeMock.mockResolvedValue([
            {
                path: "finance",
                name: "finance",
                displayName: "Finanzen",
                level: 0,
                children: [],
            },
        ]);

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

    // Regression pin: in Dexie-only mode (GitHub Pages PWA, no backend)
    // the tree must build from the flat categories cached in Dexie
    // instead of calling GET /api/categories/tree, which 404s and pops
    // an error toast.
    it("builds the tree from the Dexie cache without calling the API in Dexie-only mode", async () => {
        backendAvailable.mockResolvedValue(false);
        const errorSpy = vi.spyOn(notify, "error");
        await db.categories.bulkAdd([
            {id: 1, path: "finance", parentPath: null, name: "finance", displayName: "Finanzen", level: 0},
            {id: 2, path: "finance/bank", parentPath: "finance", name: "bank", displayName: "Bank", level: 1},
        ]);

        render(
            <MemoryRouter>
                <CategoryBrowse />
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("category-node-finance")).toBeInTheDocument();
        });
        expect(treeMock).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

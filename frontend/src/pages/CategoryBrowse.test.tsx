import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import CategoryBrowse from "./CategoryBrowse";

vi.mock("../api/client", () => ({
    api: {
        categories: {
            tree: vi.fn().mockResolvedValue([
                {
                    path: "finance",
                    name: "finance",
                    displayName: "Finanzen",
                    level: 0,
                    children: [],
                },
            ]),
        },
        items: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("CategoryBrowse", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders the tree and the right pane", async () => {
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
    });
});

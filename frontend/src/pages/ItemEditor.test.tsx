import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ItemEditor from "./ItemEditor";

vi.mock("../api/client", () => ({
    api: {
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {
            get: vi.fn().mockResolvedValue({
                id: 1,
                containerId: 1,
                content: "Bank statement",
                priority: "high",
                categoryPath: "finance/bank",
                notes: null,
                createdAt: "",
                updatedAt: "",
            }),
        },
        categories: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("ItemEditor", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders the edit form for an existing item", async () => {
        render(
            <MemoryRouter initialEntries={["/items/1"]}>
                <Routes>
                    <Route path="/items/:id" element={<ItemEditor />} />
                </Routes>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("item-editor-title")).toBeInTheDocument();
            expect(screen.getByTestId("item-editor-form")).toBeInTheDocument();
        });
        const input = screen.getByTestId("item-editor-content-input") as HTMLInputElement;
        await waitFor(() => expect(input.value).toBe("Bank statement"));
    });

    it("renders the new-item form when route is /items/new", async () => {
        render(
            <MemoryRouter initialEntries={["/items/new"]}>
                <Routes>
                    <Route path="/items/new" element={<ItemEditor />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.getByTestId("item-editor-title")).toBeInTheDocument();
        expect(screen.getByTestId("item-editor-form")).toBeInTheDocument();
    });
});

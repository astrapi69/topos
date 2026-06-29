import "fake-indexeddb/auto";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerDetail from "./ContainerDetail";
import {DialogProvider} from "../components/AppDialog";

vi.mock("../api/client", () => ({
    api: {
        containers: {
            get: vi.fn().mockResolvedValue({
                id: 1,
                externalId: 1001,
                type: "folder",
                owner: "self",
                label: "Folder 1001",
                description: null,
                location: "Office",
                sizeGroup: null,
                createdAt: "2026-01-01T00:00:00",
                updatedAt: "2026-01-01T00:00:00",
            }),
        },
        items: {
            list: vi.fn().mockResolvedValue([
                {
                    id: 7,
                    containerId: 1,
                    content: "Sparkassen-Vertrag",
                    priority: "none",
                    categoryPath: null,
                    notes: null,
                    createdAt: "2026-01-01T00:00:00",
                    updatedAt: "2026-01-01T00:00:00",
                },
            ]),
            delete: vi.fn().mockResolvedValue(undefined),
        },
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("ContainerDetail", () => {
    beforeEach(() => vi.clearAllMocks());

    it("loads and renders the container metadata", async () => {
        render(
            <MemoryRouter initialEntries={["/containers/1"]}>
                <DialogProvider>
                    <Routes>
                        <Route path="/containers/:id" element={<ContainerDetail />} />
                    </Routes>
                </DialogProvider>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("container-detail-title")).toHaveTextContent("Folder 1001");
        });
        expect(screen.getByTestId("container-meta")).toBeInTheDocument();
    });

    it("asks for confirmation before deleting an item, then deletes on confirm", async () => {
        const {api} = await import("../api/client");
        render(
            <MemoryRouter initialEntries={["/containers/1"]}>
                <DialogProvider>
                    <Routes>
                        <Route path="/containers/:id" element={<ContainerDetail />} />
                    </Routes>
                </DialogProvider>
            </MemoryRouter>,
        );
        const deleteBtn = await screen.findByTestId("delete-item-7");
        fireEvent.click(deleteBtn);

        // The AppDialog confirm appears; delete must NOT have fired yet.
        const confirmBtn = await screen.findByTestId("app-dialog-confirm");
        expect(api.items.delete).not.toHaveBeenCalled();

        fireEvent.click(confirmBtn);
        await waitFor(() => expect(api.items.delete).toHaveBeenCalledWith(7));
    });

    it("does not delete when the confirmation is cancelled", async () => {
        const {api} = await import("../api/client");
        render(
            <MemoryRouter initialEntries={["/containers/1"]}>
                <DialogProvider>
                    <Routes>
                        <Route path="/containers/:id" element={<ContainerDetail />} />
                    </Routes>
                </DialogProvider>
            </MemoryRouter>,
        );
        fireEvent.click(await screen.findByTestId("delete-item-7"));
        fireEvent.click(await screen.findByTestId("app-dialog-cancel"));
        await new Promise((r) => setTimeout(r, 20));
        expect(api.items.delete).not.toHaveBeenCalled();
    });
});

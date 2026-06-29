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
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue(undefined),
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
        actions: {
            list: vi.fn().mockResolvedValue([
                {
                    id: 9,
                    itemId: 7,
                    text: "Konto kündigen",
                    status: "open",
                    dueDate: null,
                    createdAt: "2026-01-01T00:00:00",
                    completedAt: null,
                },
            ]),
        },
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

function renderDetail() {
    return render(
        <MemoryRouter initialEntries={["/containers/1"]}>
            <DialogProvider>
                <Routes>
                    <Route path="/containers/:id" element={<ContainerDetail />} />
                </Routes>
            </DialogProvider>
        </MemoryRouter>,
    );
}

describe("ContainerDetail", () => {
    beforeEach(() => vi.clearAllMocks());

    it("loads and renders the container metadata", async () => {
        renderDetail();
        await waitFor(() => {
            expect(screen.getByTestId("container-detail-title")).toHaveTextContent("Folder 1001");
        });
        expect(screen.getByTestId("container-meta")).toBeInTheDocument();
        expect(screen.getByTestId("container-detail-edit")).toBeInTheDocument();
        expect(screen.getByTestId("container-detail-delete")).toBeInTheDocument();
    });

    it("asks for confirmation before deleting an item, then deletes on confirm", async () => {
        const {api} = await import("../api/client");
        renderDetail();
        fireEvent.click(await screen.findByTestId("delete-item-7"));
        const confirmBtn = await screen.findByTestId("app-dialog-confirm");
        expect(api.items.delete).not.toHaveBeenCalled();
        fireEvent.click(confirmBtn);
        await waitFor(() => expect(api.items.delete).toHaveBeenCalledWith(7));
    });

    it("does not delete when the confirmation is cancelled", async () => {
        const {api} = await import("../api/client");
        renderDetail();
        fireEvent.click(await screen.findByTestId("delete-item-7"));
        fireEvent.click(await screen.findByTestId("app-dialog-cancel"));
        await new Promise((r) => setTimeout(r, 20));
        expect(api.items.delete).not.toHaveBeenCalled();
    });

    it("shows a per-item action badge with count and expands the action list", async () => {
        renderDetail();
        const badge = await screen.findByTestId("item-actions-badge-7");
        expect(badge).toHaveTextContent("1");
        expect(screen.queryByTestId("item-actions-list-7")).not.toBeInTheDocument();
        fireEvent.click(badge);
        expect(screen.getByTestId("item-actions-list-7")).toHaveTextContent("Konto kündigen");
    });

    it("edits the container metadata", async () => {
        const {api} = await import("../api/client");
        renderDetail();
        fireEvent.click(await screen.findByTestId("container-detail-edit"));
        const label = screen.getByTestId("container-edit-label") as HTMLInputElement;
        expect(label.value).toBe("Folder 1001");
        fireEvent.change(label, {target: {value: "Folder 1001 (neu)"}});
        fireEvent.click(screen.getByTestId("container-edit-save"));
        await waitFor(() =>
            expect(api.containers.update).toHaveBeenCalledWith(
                1,
                expect.objectContaining({label: "Folder 1001 (neu)"}),
            ),
        );
    });

    it("deletes the container after confirmation", async () => {
        const {api} = await import("../api/client");
        renderDetail();
        fireEvent.click(await screen.findByTestId("container-detail-delete"));
        fireEvent.click(await screen.findByTestId("app-dialog-confirm"));
        await waitFor(() => expect(api.containers.delete).toHaveBeenCalledWith(1));
    });
});

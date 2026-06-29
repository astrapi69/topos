import "fake-indexeddb/auto";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerList from "./ContainerList";
import {DialogProvider} from "../components/AppDialog";

const container1 = {
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
};

vi.mock("../api/client", () => ({
    api: {
        containers: {
            list: vi.fn().mockResolvedValue([
                {
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
                },
            ]),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue(undefined),
        },
        items: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

function renderList() {
    return render(
        <MemoryRouter>
            <DialogProvider>
                <ContainerList />
            </DialogProvider>
        </MemoryRouter>,
    );
}

describe("ContainerList", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders header, table, and row actions", async () => {
        renderList();
        expect(screen.getByTestId("container-list-title")).toBeInTheDocument();
        expect(screen.getByTestId("container-table")).toBeInTheDocument();
        expect(screen.getByTestId("container-new-button")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("container-row-1")).toBeInTheDocument();
        });
        expect(screen.getByTestId("container-edit-1")).toBeInTheDocument();
        expect(screen.getByTestId("container-delete-1")).toBeInTheDocument();
    });

    it("opens the create form and submits a new container", async () => {
        const {api} = await import("../api/client");
        renderList();
        fireEvent.click(screen.getByTestId("container-new-button"));
        expect(screen.getByTestId("container-form")).toBeInTheDocument();

        fireEvent.change(screen.getByTestId("container-form-external-id"), {target: {value: "5005"}});
        fireEvent.change(screen.getByTestId("container-form-label"), {target: {value: "Neuer Ordner"}});
        fireEvent.change(screen.getByTestId("container-form-type"), {target: {value: "box"}});
        fireEvent.click(screen.getByTestId("container-form-submit"));

        await waitFor(() =>
            expect(api.containers.create).toHaveBeenCalledWith(
                expect.objectContaining({externalId: 5005, label: "Neuer Ordner", type: "box", owner: "self"}),
            ),
        );
    });

    it("prefills the form on edit and disables the external id", async () => {
        renderList();
        await screen.findByTestId("container-edit-1");
        fireEvent.click(screen.getByTestId("container-edit-1"));
        const externalId = screen.getByTestId("container-form-external-id") as HTMLInputElement;
        const label = screen.getByTestId("container-form-label") as HTMLInputElement;
        expect(externalId.value).toBe("1001");
        expect(externalId).toBeDisabled();
        expect(label.value).toBe("Folder 1001");
    });

    it("confirms before deleting a container, then deletes on confirm", async () => {
        const {api} = await import("../api/client");
        renderList();
        await screen.findByTestId("container-delete-1");
        fireEvent.click(screen.getByTestId("container-delete-1"));

        const confirmBtn = await screen.findByTestId("app-dialog-confirm");
        expect(api.containers.delete).not.toHaveBeenCalled();
        fireEvent.click(confirmBtn);
        await waitFor(() => expect(api.containers.delete).toHaveBeenCalledWith(1));
    });

    it("does not delete when the confirmation is cancelled", async () => {
        const {api} = await import("../api/client");
        renderList();
        await screen.findByTestId("container-delete-1");
        fireEvent.click(screen.getByTestId("container-delete-1"));
        fireEvent.click(await screen.findByTestId("app-dialog-cancel"));
        await new Promise((r) => setTimeout(r, 20));
        expect(api.containers.delete).not.toHaveBeenCalled();
    });
});

// container1 kept for reference symmetry with other page tests.
void container1;

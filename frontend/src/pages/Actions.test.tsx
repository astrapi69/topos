import "fake-indexeddb/auto";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Actions from "./Actions";
import {DialogProvider} from "../components/AppDialog";
import type {ActionRow} from "../types/topos";

const openAction: ActionRow = {
    id: 5,
    itemId: 7,
    text: "Vertrag kündigen",
    status: "open",
    dueDate: "2026-07-01",
    createdAt: "2026-01-01T00:00:00",
    completedAt: null,
};

vi.mock("../api/client", () => ({
    api: {
        actions: {
            list: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue(undefined),
            complete: vi.fn().mockResolvedValue({}),
            reopen: vi.fn().mockResolvedValue({}),
        },
        items: {
            list: vi.fn().mockResolvedValue([
                {
                    id: 7,
                    containerId: 1,
                    content: "Citibank Vertrag",
                    priority: "none",
                    categoryPath: null,
                    notes: null,
                    createdAt: "2026-01-01T00:00:00",
                    updatedAt: "2026-01-01T00:00:00",
                },
            ]),
        },
        containers: {
            list: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    externalId: 1002,
                    type: "folder",
                    owner: "self",
                    label: "Folder 1002",
                    description: null,
                    location: null,
                    sizeGroup: null,
                    createdAt: "2026-01-01T00:00:00",
                    updatedAt: "2026-01-01T00:00:00",
                },
            ]),
        },
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

function renderActions() {
    return render(
        <MemoryRouter>
            <DialogProvider>
                <Actions />
            </DialogProvider>
        </MemoryRouter>,
    );
}

describe("Actions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders the empty state and all status filters", async () => {
        renderActions();
        expect(screen.getByTestId("actions-title")).toBeInTheDocument();
        for (const f of ["open", "done", "archived", "all"]) {
            expect(screen.getByTestId(`actions-filter-${f}`)).toBeInTheDocument();
        }
        await waitFor(() => {
            expect(screen.getByTestId("actions-empty")).toBeInTheDocument();
        });
    });

    it("toggles the create form via the New action button", async () => {
        renderActions();
        expect(screen.queryByTestId("actions-create-form")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("actions-new-button"));
        expect(screen.getByTestId("actions-create-form")).toBeInTheDocument();
        expect(screen.getByTestId("action-create-item")).toBeInTheDocument();
        expect(screen.getByTestId("action-create-text")).toBeInTheDocument();
        expect(screen.getByTestId("action-create-due")).toBeInTheDocument();
    });

    it("renders an open action with complete/edit/delete controls and an item link", async () => {
        const {api} = await import("../api/client");
        vi.mocked(api.actions.list).mockResolvedValue([{...openAction}]);
        renderActions();
        await waitFor(() => {
            expect(screen.getByTestId("action-row-5")).toBeInTheDocument();
        });
        expect(screen.getByTestId("action-complete-5")).toBeInTheDocument();
        expect(screen.getByTestId("action-edit-5")).toBeInTheDocument();
        expect(screen.getByTestId("action-delete-5")).toBeInTheDocument();
        expect(screen.getByTestId("action-item-link-5")).toHaveAttribute("href", "/containers/1");
    });

    it("shows a reopen control for a done action", async () => {
        const {api} = await import("../api/client");
        vi.mocked(api.actions.list).mockResolvedValue([{...openAction, status: "done"}]);
        renderActions();
        await waitFor(() => {
            expect(screen.getByTestId("action-reopen-5")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("action-complete-5")).not.toBeInTheDocument();
    });

    it("creates an action through the form", async () => {
        const {api} = await import("../api/client");
        renderActions();
        fireEvent.click(screen.getByTestId("actions-new-button"));
        // Wait until the item options have loaded into the picker, otherwise
        // setting the select value to a not-yet-rendered option is a no-op.
        await screen.findByRole("option", {name: "Citibank Vertrag"});
        fireEvent.change(screen.getByTestId("action-create-item"), {target: {value: "7"}});
        fireEvent.change(screen.getByTestId("action-create-text"), {target: {value: "Neue Aufgabe"}});
        fireEvent.change(screen.getByTestId("action-create-due"), {target: {value: "2026-08-01"}});
        fireEvent.click(screen.getByTestId("action-create-submit"));
        await waitFor(() =>
            expect(api.actions.create).toHaveBeenCalledWith({
                itemId: 7,
                text: "Neue Aufgabe",
                dueDate: "2026-08-01",
            }),
        );
    });
});

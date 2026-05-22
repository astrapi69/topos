import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerList from "./ContainerList";

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
        },
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("ContainerList", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders header and table", async () => {
        render(
            <MemoryRouter>
                <ContainerList />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("container-list-title")).toBeInTheDocument();
        expect(screen.getByTestId("container-table")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("container-row-1")).toBeInTheDocument();
        });
    });
});

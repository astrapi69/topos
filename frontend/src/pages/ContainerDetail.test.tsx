import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerDetail from "./ContainerDetail";

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
        items: {list: vi.fn().mockResolvedValue([])},
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
                <Routes>
                    <Route path="/containers/:id" element={<ContainerDetail />} />
                </Routes>
            </MemoryRouter>,
        );
        await waitFor(() => {
            expect(screen.getByTestId("container-detail-title")).toHaveTextContent("Folder 1001");
        });
        expect(screen.getByTestId("container-meta")).toBeInTheDocument();
    });
});

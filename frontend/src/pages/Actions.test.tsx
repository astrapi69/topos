import "fake-indexeddb/auto";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Actions from "./Actions";

vi.mock("../api/client", () => ({
    api: {
        actions: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([])},
        containers: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("Actions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders with an empty state", async () => {
        render(
            <MemoryRouter>
                <Actions />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("actions-title")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("actions-empty")).toBeInTheDocument();
        });
    });
});

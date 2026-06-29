import "fake-indexeddb/auto";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Import from "./Import";
import {DialogProvider} from "../components/AppDialog";

vi.mock("../api/client", () => ({
    api: {
        importExcel: vi.fn().mockResolvedValue({
            containersCreated: 0,
            containersUpdated: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            itemsPruned: 0,
            actionsCreated: 0,
            categoriesCreated: 0,
            warnings: [],
        }),
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([])},
        categories: {list: vi.fn().mockResolvedValue([])},
        actions: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("Import", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders the upload form", () => {
        render(
            <MemoryRouter>
                <DialogProvider>
                    <Import />
                </DialogProvider>
            </MemoryRouter>,
        );
        expect(screen.getByTestId("import-title")).toBeInTheDocument();
        expect(screen.getByTestId("import-form")).toBeInTheDocument();
        expect(screen.getByTestId("import-dropzone")).toBeInTheDocument();
        expect(screen.getByTestId("import-submit")).toBeDisabled();
    });
});

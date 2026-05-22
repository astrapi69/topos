import "fake-indexeddb/auto";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Settings from "./Settings";

vi.mock("../api/client", () => ({
    api: {
        containers: {list: vi.fn().mockResolvedValue([])},
        items: {list: vi.fn().mockResolvedValue([])},
        categories: {list: vi.fn().mockResolvedValue([])},
        actions: {list: vi.fn().mockResolvedValue([])},
        i18n: {get: vi.fn().mockResolvedValue({})},
        settings: {getApp: vi.fn().mockResolvedValue({})},
    },
    ApiError: class extends Error {},
}));

describe("Settings", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders language, theme, and reset controls", () => {
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("settings-title")).toBeInTheDocument();
        expect(screen.getByTestId("settings-language-select")).toBeInTheDocument();
        expect(screen.getByTestId("settings-theme-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("settings-reset-cache")).toBeInTheDocument();
    });
});

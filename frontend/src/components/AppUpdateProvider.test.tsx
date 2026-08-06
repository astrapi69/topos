import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import AppUpdateProvider from "./AppUpdateProvider";

// i18n mocked: buildMessages resolves via t(key, fallback), so the fallbacks
// are what render offline (GitHub Pages has no backend catalog).
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_key: string, fallback?: string) => fallback ?? _key, lang: "de"}),
}));

describe("AppUpdateProvider", () => {
    it("mounts the pwa-update provider and renders its children", () => {
        render(
            <AppUpdateProvider>
                <div data-testid="child">inventory</div>
            </AppUpdateProvider>,
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });
});

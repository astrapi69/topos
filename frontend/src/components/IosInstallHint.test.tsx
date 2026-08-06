import {render, screen, fireEvent} from "@testing-library/react";
import {describe, it, expect, vi, afterEach} from "vitest";

import IosInstallHint from "./IosInstallHint";

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_key: string, fallback?: string) => fallback ?? _key, lang: "de"}),
}));

const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function stubNavigator(userAgent: string, platform: string, maxTouchPoints: number) {
    Object.defineProperty(navigator, "userAgent", {value: userAgent, configurable: true});
    Object.defineProperty(navigator, "platform", {value: platform, configurable: true});
    Object.defineProperty(navigator, "maxTouchPoints", {value: maxTouchPoints, configurable: true});
}

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("IosInstallHint", () => {
    it("does not render on a non-iOS platform", () => {
        stubNavigator("Mozilla/5.0 (X11; Linux x86_64) Chrome/120", "Linux x86_64", 0);
        render(<IosInstallHint />);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });

    it("renders on iOS Safari and dismisses (persisted)", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone", 5);
        const {unmount} = render(<IosInstallHint />);
        expect(screen.getByTestId("ios-install-hint")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("ios-install-hint-dismiss"));
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
        expect(localStorage.getItem("topos.ios_install_dismissed")).toBe("1");

        // A remount stays hidden because the dismissal is persisted.
        unmount();
        render(<IosInstallHint />);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });
});

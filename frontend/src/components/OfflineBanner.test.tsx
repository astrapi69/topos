import {render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import OfflineBanner from "./OfflineBanner";

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb}),
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("OfflineBanner", () => {
    it("stays hidden when the backend health probe succeeds", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true}));
        render(<OfflineBanner />);
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    it("shows the offline banner when the probe rejects (no backend)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no backend")));
        render(<OfflineBanner />);
        await waitFor(() => {
            expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
        });
    });

    it("shows the offline banner on a non-ok health response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: false}));
        render(<OfflineBanner />);
        await waitFor(() => {
            expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
        });
    });
});

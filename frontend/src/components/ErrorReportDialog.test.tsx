import {render, screen, waitFor, fireEvent, act} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import ErrorReportDialog from "./ErrorReportDialog";

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb}),
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

function fireOpen(message: string) {
    act(() => {
        window.dispatchEvent(
            new CustomEvent("topos:open-error-report", {detail: {message}}),
        );
    });
}

describe("ErrorReportDialog", () => {
    it("stays closed until the open-error-report event fires", () => {
        render(<ErrorReportDialog />);
        expect(screen.queryByTestId("error-report-dialog")).not.toBeInTheDocument();
    });

    it("opens on the event and previews the error message", async () => {
        render(<ErrorReportDialog />);
        fireOpen("Container konnte nicht gespeichert werden");
        await waitFor(() => {
            expect(screen.getByTestId("error-report-dialog")).toBeInTheDocument();
        });
        expect(screen.getByTestId("error-report-preview").textContent).toContain(
            "Container konnte nicht gespeichert werden",
        );
    });

    it("opens a prefilled GitHub issue URL on submit", async () => {
        const openSpy = vi.fn();
        vi.stubGlobal("open", openSpy);
        render(<ErrorReportDialog />);
        fireOpen("Boom");
        await waitFor(() => screen.getByTestId("error-report-submit"));

        fireEvent.click(screen.getByTestId("error-report-submit"));

        expect(openSpy).toHaveBeenCalledTimes(1);
        const url = openSpy.mock.calls[0][0] as string;
        expect(url).toContain("https://github.com/astrapi69/topos/issues/new");
        expect(url).toContain("title=");
        expect(url).toContain(encodeURIComponent("Bug: Boom"));
        expect(url).toContain("labels=bug");
    });

    it("closes after submitting", async () => {
        vi.stubGlobal("open", vi.fn());
        render(<ErrorReportDialog />);
        fireOpen("Boom");
        await waitFor(() => screen.getByTestId("error-report-submit"));
        fireEvent.click(screen.getByTestId("error-report-submit"));
        await waitFor(() =>
            expect(screen.queryByTestId("error-report-dialog")).not.toBeInTheDocument(),
        );
    });
});

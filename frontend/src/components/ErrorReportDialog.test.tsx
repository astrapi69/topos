import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorReportDialog from "./ErrorReportDialog";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function fireOpen(message: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("topos:open-error-report", { detail: { message } }),
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

  it("opens a prefilled GitHub issue URL in a new tab on submit", async () => {
    // The issue opens via a programmatic anchor click (not window.open,
    // whose features string gets popup-blocked). Capture the anchor href.
    let openedHref = "";
    let openedTarget = "";
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        openedHref = this.href;
        openedTarget = this.target;
      });
    render(<ErrorReportDialog />);
    fireOpen("Boom");
    await waitFor(() => screen.getByTestId("error-report-submit"));

    fireEvent.click(screen.getByTestId("error-report-submit"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(openedTarget).toBe("_blank");
    expect(openedHref).toContain(
      "https://github.com/astrapi69/topos/issues/new",
    );
    expect(openedHref).toContain("title=");
    expect(openedHref).toContain(encodeURIComponent("Bug: Boom"));
    expect(openedHref).toContain("labels=bug");
    clickSpy.mockRestore();
  });

  it("copies the report to the clipboard", async () => {
    // Reported from an iPhone: the preview <pre> cannot be selected there,
    // so without a button the report text is unreachable - the GitHub
    // deep-link is the only exit, and it needs a GitHub account. Same
    // pattern as adaptive-learner's dialog.
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<ErrorReportDialog />);
    fireOpen("Kaputt");
    fireEvent.click(await screen.findByTestId("error-report-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("Kaputt");
    // Feedback lands in the button itself, not a toast over the dialog.
    await screen.findByText("Kopiert!");
  });

  it("says so when the clipboard is unavailable", async () => {
    // No clipboard API (http, permission denied): the button must report
    // failure instead of pretending success.
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    render(<ErrorReportDialog />);
    fireOpen("Kaputt");
    fireEvent.click(await screen.findByTestId("error-report-copy"));

    await screen.findByText("Kopieren fehlgeschlagen");
  });

  it("closes after submitting", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<ErrorReportDialog />);
    fireOpen("Boom");
    await waitFor(() => screen.getByTestId("error-report-submit"));
    fireEvent.click(screen.getByTestId("error-report-submit"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("error-report-dialog"),
      ).not.toBeInTheDocument(),
    );
    clickSpy.mockRestore();
  });

  it("omits the reproduction section when no steps are entered", async () => {
    render(<ErrorReportDialog />);
    fireOpen("Boom");
    await waitFor(() => screen.getByTestId("error-report-preview"));
    // No empty "1.\n2.\n3." placeholder in the generated body.
    expect(
      screen.getByTestId("error-report-preview").textContent,
    ).not.toContain("## Reproduktion");
  });
});

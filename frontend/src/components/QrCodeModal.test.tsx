import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QrCodeModal from "./QrCodeModal";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,FAKEQR") },
}));

beforeEach(() => vi.clearAllMocks());

describe("QrCodeModal", () => {
  it("renders the QR image and the encoded URL", async () => {
    render(
      <QrCodeModal
        url="https://example.test/topos/containers/5"
        title="Share"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("qr-code-modal-url").textContent).toBe(
      "https://example.test/topos/containers/5",
    );
    await waitFor(() =>
      expect(screen.getByTestId("qr-code-modal-image")).toHaveAttribute(
        "src",
        "data:image/png;base64,FAKEQR",
      ),
    );
  });

  it("copies the URL and reports it", async () => {
    const onCopied = vi.fn();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <QrCodeModal
        url="https://example.test/x"
        title="Share"
        onClose={vi.fn()}
        onCopied={onCopied}
      />,
    );
    fireEvent.click(screen.getByTestId("qr-code-modal-copy"));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://example.test/x"),
    );
    expect(onCopied).toHaveBeenCalled();
  });

  it("closes on the X button and on Escape", () => {
    const onClose = vi.fn();
    render(
      <QrCodeModal
        url="https://example.test/x"
        title="Share"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("qr-code-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

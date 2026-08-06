import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLabelSheetHtml, printContainerLabels } from "./printLabels";
import type { Container } from "../types/topos";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") },
}));
vi.mock("./shareUrl", () => ({
  containerShareUrl: (id: number) => `https://x/topos/containers/${id}`,
}));

afterEach(() => vi.clearAllMocks());

describe("buildLabelSheetHtml", () => {
  it("renders one label per row and escapes user text", () => {
    const html = buildLabelSheetHtml(
      [{ qr: "data:img", externalId: 7, label: "A & <b>" }],
      { documentTitle: "Sheet", idLabel: "Nr." },
    );
    expect(html).toContain("Nr. 7");
    expect(html).toContain("A &amp; &lt;b&gt;");
    expect((html.match(/class="label"/g) ?? []).length).toBe(1);
  });
});

describe("printContainerLabels", () => {
  it("generates a QR for each container's public share URL", async () => {
    vi.useFakeTimers();
    const QRCode = (await import("qrcode")).default;
    const containers = [
      { id: 1, externalId: 9001, label: "A" },
      { id: 2, externalId: 9002, label: "B" },
    ] as Container[];

    await printContainerLabels(containers, {
      documentTitle: "Sheet",
      idLabel: "Nr.",
    });

    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      "https://x/topos/containers/1",
      expect.anything(),
    );
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      "https://x/topos/containers/2",
      expect.anything(),
    );
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

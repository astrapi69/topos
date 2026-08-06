/**
 * Printable container-label sheet. Generates one QR (encoding the container's
 * public detail URL) per selected container, lays them out in a print grid,
 * and prints via a hidden iframe + window.print() - no PDF library, following
 * adaptive-learner's markdown->print pattern. The browser's print dialog lets
 * the user "Save as PDF" or print onto a label sheet.
 */

import QRCode from "qrcode";

import type {Container} from "../types/topos";
import {containerShareUrl} from "./shareUrl";

export interface LabelSheetStrings {
    /** <title> of the generated print document. */
    documentTitle: string;
    /** Prefix in front of the external id (e.g. "Nr."). */
    idLabel: string;
}

interface RenderedLabel {
    qr: string;
    externalId: number;
    label: string;
}

function escapeHtml(value: string): string {
    const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return value.replace(/[&<>"']/g, (ch) => map[ch]);
}

/** Build the standalone print HTML for a set of rendered labels (pure). */
export function buildLabelSheetHtml(labels: RenderedLabel[], strings: LabelSheetStrings): string {
    const cells = labels
        .map(
            (row) => `
      <div class="label">
        <img class="qr" src="${row.qr}" alt="" />
        <div class="meta">
          <div class="extid">${strings.idLabel} ${row.externalId}</div>
          <div class="name">${escapeHtml(row.label)}</div>
        </div>
      </div>`,
        )
        .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
        strings.documentTitle,
    )}</title><style>
      @page { margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: sans-serif; margin: 0; color: #111; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
      .label { display: flex; align-items: center; gap: 3mm; border: 1px solid #ccc;
               border-radius: 4px; padding: 3mm; page-break-inside: avoid; }
      .qr { width: 24mm; height: 24mm; flex: 0 0 auto; }
      .meta { min-width: 0; }
      .extid { font-weight: 700; font-family: monospace; font-size: 11pt; }
      .name { font-size: 9pt; word-break: break-word; }
    </style></head><body><div class="sheet">${cells}</div></body></html>`;
}

/** Print an HTML document through a throwaway hidden iframe. */
function printHtmlInIframe(html: string): void {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "0",
        height: "0",
        border: "0",
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow;
    const cleanup = () => window.setTimeout(() => iframe.remove(), 1000);
    if (win) {
        win.onafterprint = cleanup;
        // Data-URL images are inline, so a short tick is enough for paint.
        window.setTimeout(() => {
            win.focus();
            win.print();
        }, 200);
    } else {
        cleanup();
    }
}

/** Render QR labels for the given containers and open the print dialog. */
export async function printContainerLabels(
    containers: Container[],
    strings: LabelSheetStrings,
): Promise<void> {
    const labels: RenderedLabel[] = await Promise.all(
        containers.map(async (container) => ({
            qr: await QRCode.toDataURL(containerShareUrl(container.id), {
                errorCorrectionLevel: "M",
                margin: 1,
                width: 240,
            }),
            externalId: container.externalId,
            label: container.label,
        })),
    );
    printHtmlInIframe(buildLabelSheetHtml(labels, strings));
}

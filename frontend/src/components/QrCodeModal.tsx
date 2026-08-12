/**
 * QrCodeModal - show a scannable QR code for a URL in a centered modal, with
 * copy / download (PNG) / native-share actions.
 *
 * Ported 1:1 from adaptive-learner (shared/feedback/QrCodeModal.tsx), remapped
 * onto Topos token classes. App-agnostic and props-driven: the URL, title, and
 * button labels arrive as props (English fallbacks); the only required wiring
 * is onClose. The QR is generated client-side via `qrcode` at error-correction
 * level H and rendered on a white backing so it scans on any theme.
 *
 * @example
 * <QrCodeModal
 *   url="https://astrapi69.github.io/topos/containers/5"
 *   title="Share via QR code"
 *   onClose={() => setOpen(false)}
 * />
 */

import { Copy, Download, Share2, X } from "lucide-react";
import QRCode from "qrcode";

import { btn, btnPrimary } from "../ui/classes";
import { type ReactNode, useEffect, useState } from "react";

export interface QrCodeModalLabels {
  close?: string;
  copy?: string;
  copied?: string;
  download?: string;
  share?: string;
  /** Accessible label for the generated QR image. */
  imageAlt?: string;
}

export interface QrCodeModalProps {
  /** The URL the QR code encodes (also shown as copyable text). */
  url: string;
  /** Modal heading. */
  title: string;
  /** Optional muted note under the URL. */
  note?: ReactNode;
  /** Called when the modal should close (backdrop, X, or Escape). */
  onClose: () => void;
  /** Optional control labels (English fallbacks applied per field). */
  labels?: QrCodeModalLabels;
  /** Download filename for the PNG. */
  fileName?: string;
  /** Reported after a successful clipboard copy of the URL. */
  onCopied?: () => void;
  /** Reported after a native share resolves. */
  onShared?: (method: "shared" | "cancelled") => void;
  testId?: string;
}

/** Best-effort clipboard write (secure-context only). */
async function copyText(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Turn the QR PNG data URL into a File for the Web Share API. */
async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], fileName, { type: "image/png" });
}

interface ResolvedLabels {
  close: string;
  copy: string;
  copied: string;
  download: string;
  share: string;
  imageAlt: string;
}

function resolveLabels(labels?: QrCodeModalLabels): ResolvedLabels {
  return {
    close: labels?.close ?? "Close",
    copy: labels?.copy ?? "Copy URL",
    copied: labels?.copied ?? "Copied",
    download: labels?.download ?? "Download",
    share: labels?.share ?? "Share",
    imageAlt: labels?.imageAlt ?? "QR code",
  };
}

export default function QrCodeModal({
  url,
  title,
  note,
  onClose,
  labels,
  fileName = "topos-qr.png",
  onCopied,
  onShared,
  testId = "qr-code-modal",
}: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  const text = resolveLabels(labels);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 256 })
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {
        /* A QR we cannot render leaves the image area empty; the
                   copyable URL below still lets the user share. */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    if (!dataUrl || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (!nav.canShare) return;
    void dataUrlToFile(dataUrl, fileName).then((file) => {
      if (!cancelled && nav.canShare?.({ files: [file] })) {
        setCanShareFiles(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dataUrl, fileName]);

  const handleCopy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const nav =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & {
            share?: (data: ShareData) => Promise<void>;
            canShare?: (data: ShareData) => boolean;
          })
        : undefined;
    if (!nav?.share) return;
    try {
      if (dataUrl && canShareFiles) {
        const file = await dataUrlToFile(dataUrl, fileName);
        await nav.share({ title, text: title, url, files: [file] });
      } else {
        await nav.share({ title, text: title, url });
      }
      onShared?.("shared");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        onShared?.("cancelled");
      }
    }
  };

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
      data-testid={testId}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded text-ink-secondary hover:bg-muted hover:text-ink"
          data-testid={`${testId}-close`}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2
          id={`${testId}-title`}
          className="mb-4 pr-8 text-lg font-semibold text-ink"
        >
          {title}
        </h2>

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-md bg-white p-3">
            {dataUrl && (
              <img
                src={dataUrl}
                alt={text.imageAlt}
                width={224}
                height={224}
                className="block h-56 w-56"
                data-testid={`${testId}-image`}
              />
            )}
          </div>

          <code
            className="w-full break-all rounded bg-muted px-2 py-1 text-center text-xs text-ink-secondary"
            data-testid={`${testId}-url`}
          >
            {url}
          </code>

          {note && (
            <p
              className="w-full text-center text-xs text-ink-muted"
              data-testid={`${testId}-note`}
            >
              {note}
            </p>
          )}

          <span
            role="status"
            aria-live="polite"
            className="sr-only"
            data-testid={`${testId}-copied-status`}
          >
            {copied ? text.copied : ""}
          </span>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={btn}
              data-testid={`${testId}-copy`}
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? text.copied : text.copy}
            </button>

            {dataUrl && (
              <a
                href={dataUrl}
                download={fileName}
                className={btn}
                data-testid={`${testId}-download`}
              >
                <Download size={14} aria-hidden="true" />
                {text.download}
              </a>
            )}

            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                className={btnPrimary}
                data-testid={`${testId}-share`}
              >
                <Share2 size={14} aria-hidden="true" />
                {text.share}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

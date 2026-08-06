/**
 * Full-size photo viewer with prev/next navigation and click-to-zoom.
 * Adapted from adaptive-learner's AvatarPreviewDialog shell (modal + backdrop
 * + Escape + overlay token), extended with gallery navigation + zoom.
 */

import { useEffect, useState } from "react";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { ContainerPhotoItem } from "../photos";

export default function PhotoLightbox({
  items,
  index,
  onIndex,
  onClose,
  closeLabel = "Close",
}: {
  items: ContainerPhotoItem[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [zoom, setZoom] = useState(false);
  const current = items[index];
  const many = items.length > 1;

  useEffect(() => {
    const prev = () => onIndex((index - 1 + items.length) % items.length);
    const next = () => onIndex((index + 1) % items.length);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && many) prev();
      else if (event.key === "ArrowRight" && many) next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, items.length, many, onIndex, onClose]);

  // Reset zoom when navigating to another photo.
  useEffect(() => setZoom(false), [index]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      data-testid="photo-lightbox"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded text-ink-inverse hover:bg-white/10"
        data-testid="photo-lightbox-close"
      >
        <X size={22} aria-hidden />
      </button>

      {many && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndex((index - 1 + items.length) % items.length);
          }}
          aria-label="Previous"
          className="absolute left-3 flex h-12 w-12 items-center justify-center rounded-full text-ink-inverse hover:bg-white/10"
          data-testid="photo-lightbox-prev"
        >
          <ChevronLeft size={28} aria-hidden />
        </button>
      )}

      <img
        src={current.fullSrc}
        alt=""
        onClick={(event) => {
          event.stopPropagation();
          setZoom((value) => !value);
        }}
        className={zoom ? "cursor-zoom-out" : "cursor-zoom-in"}
        style={{
          maxWidth: zoom ? "none" : "90vw",
          maxHeight: zoom ? "none" : "85vh",
          transform: zoom ? "scale(1.8)" : "none",
          transition: "transform 0.2s",
        }}
        data-testid="photo-lightbox-image"
      />

      {many && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndex((index + 1) % items.length);
          }}
          aria-label="Next"
          className="absolute right-3 flex h-12 w-12 items-center justify-center rounded-full text-ink-inverse hover:bg-white/10"
          data-testid="photo-lightbox-next"
        >
          <ChevronRight size={28} aria-hidden />
        </button>
      )}
    </div>
  );
}

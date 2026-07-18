/**
 * Shared Tailwind class strings for the Topos pages.
 *
 * Centralised so every page's buttons, inputs, badges and text share
 * one treatment. All colour utilities reference the token bridge in
 * tailwind.config.js (page/surface/ink/accent/line/danger), which maps
 * onto the CSS custom properties in styles/global.css. The variables
 * flip with `data-theme="dark"` on <html>, so explicit `dark:` colour
 * variants are only needed where the *structure* differs between
 * modes, not the palette.
 */

// Neutral/secondary button: generic actions, inactive filter tabs.
export const btn =
    "inline-flex items-center gap-1 px-3 py-1 rounded border border-line " +
    "bg-surface-2 text-ink hover:bg-surface-hover disabled:opacity-50 " +
    "cursor-pointer min-h-[44px] md:min-h-0";

// Primary / active state (active filter tab, primary submit).
// ink-inverse mirrors .btn-primary in global.css: white on Blue-800 in
// light mode, near-black on the lightened accent in dark mode.
export const btnPrimary =
    "inline-flex items-center gap-1 px-3 py-1 rounded bg-accent text-ink-inverse " +
    "hover:bg-accent-hover disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0";

// Destructive action: --danger-strong stays constant across modes so
// the white label keeps its contrast.
export const btnDanger =
    "inline-flex items-center gap-1 px-3 py-1 rounded bg-danger-strong text-white " +
    "hover:bg-danger-hover disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0";

// Text-style button (link-like), e.g. category tree nodes, inline delete.
export const btnText =
    "text-ink hover:underline cursor-pointer bg-transparent border-0 p-0";
export const btnTextDanger =
    "text-danger hover:underline cursor-pointer bg-transparent border-0 p-0";

// Small pill/badge that is also a toggle button.
export const badge =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-line " +
    "text-xs text-ink-secondary bg-surface-2 cursor-pointer";

// Form controls. Taller tap target on mobile (44px), compact on desktop.
// dark:bg-page drops the field one step below the card surface, the
// same figure/ground relation the light mode gets from white-on-slate.
export const input =
    "px-2 py-1 min-h-[44px] md:min-h-0 rounded border border-line " +
    "bg-surface dark:bg-page text-ink";

// Text colours.
export const text = "text-ink";
export const muted = "text-ink-muted";
export const danger = "text-danger";

// Link.
export const link = "text-accent hover:underline";

// Surfaces / containers.
export const card = "bg-surface border border-line rounded";
export const rowBorder = "border-line";

// Selected/active row background (e.g. CategoryBrowse selection).
export const selected = "bg-accent-light";

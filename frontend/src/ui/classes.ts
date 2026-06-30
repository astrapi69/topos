/**
 * Shared Tailwind class strings for the Topos pages.
 *
 * Centralised so every page's buttons, inputs, badges and text share one
 * dark-mode-correct treatment. Each entry pairs a light-mode colour with
 * an explicit `dark:` variant so nothing relies on the user-agent button
 * chrome (which caused the dark-on-dark "grey blob" buttons).
 *
 * The theme is toggled via `data-theme="dark"` on <html>; tailwind.config
 * maps the `dark:` variant onto that attribute.
 */

// Neutral/secondary button: generic actions, inactive filter tabs.
export const btn =
    "inline-flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 " +
    "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 " +
    "hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0";

// Primary / active state (active filter tab, primary submit).
export const btnPrimary =
    "inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 text-white " +
    "hover:bg-blue-700 disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0";

// Destructive action: readable on both modes.
export const btnDanger =
    "inline-flex items-center gap-1 px-3 py-1 rounded bg-red-600 text-white " +
    "hover:bg-red-700 disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0";

// Text-style button (link-like), e.g. category tree nodes, inline delete.
export const btnText =
    "text-gray-900 dark:text-gray-100 hover:underline cursor-pointer bg-transparent border-0 p-0";
export const btnTextDanger =
    "text-red-600 dark:text-red-400 hover:underline cursor-pointer bg-transparent border-0 p-0";

// Small pill/badge that is also a toggle button.
export const badge =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 " +
    "text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 cursor-pointer";

// Form controls. Taller tap target on mobile (44px), compact on desktop.
export const input =
    "px-2 py-1 min-h-[44px] md:min-h-0 rounded border border-gray-300 dark:border-gray-600 " +
    "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";

// Text colours.
export const text = "text-gray-900 dark:text-gray-100";
export const muted = "text-gray-500 dark:text-gray-400";
export const danger = "text-red-600 dark:text-red-400";

// Link.
export const link = "text-blue-600 dark:text-blue-400 hover:underline";

// Surfaces / containers.
export const card =
    "bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded";
export const rowBorder = "border-gray-200 dark:border-gray-700";

// Selected/active row background (e.g. CategoryBrowse selection).
export const selected = "bg-blue-100 dark:bg-blue-900/40";

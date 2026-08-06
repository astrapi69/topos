/**
 * Theme registry. Topos ships a curated set of themes (adapted from the
 * adaptive-learner theme system, rewritten onto Topos token names and the
 * v3 Tailwind bridge).
 *
 * Two attributes on <html> drive the look (set by hooks/useTheme.ts):
 *   - `data-theme` = the light/dark FAMILY. Keeps the Tailwind `dark:`
 *     variant working (tailwind.config keys it to `[data-theme="dark"]`).
 *   - `data-app-theme` = the theme IDENTITY. Each non-base theme ships a
 *     `:root[data-app-theme="<id>"]` block in styles/themes/theme-<id>.css
 *     that overrides the colour tokens.
 *
 * `light` and `dark` are the BASE palettes and live in styles/global.css
 * (`:root` + `[data-theme="dark"]`); they need no data-app-theme override
 * block. The other themes each redefine the full colour-token contract
 * (enforced by styles/themes/themes.test.ts).
 */

export type ThemeFamily = "light" | "dark";

export type ThemeId =
  "light" | "dark" | "graphite" | "soft-pop" | "high-contrast" | "ocean";

export interface Theme {
  id: ThemeId;
  /** English fallback label; the UI localizes via `t("ui.themes.<id>")`. */
  label: string;
  /** Drives `data-theme` so the Tailwind `dark:` variant stays correct. */
  family: ThemeFamily;
  /** One-line English fallback description for the picker. */
  description: string;
  /** Swatch colours for the picker card (page bg, accent, text). */
  previewColors: { bg: string; accent: string; fg: string };
}

export const THEMES: readonly Theme[] = [
  {
    id: "light",
    label: "Light",
    family: "light",
    description: "Cool slate with a Blue-800 anchor. The default.",
    previewColors: { bg: "#f8fafc", accent: "#1e40af", fg: "#0f172a" },
  },
  {
    id: "dark",
    label: "Dark",
    family: "dark",
    description: "Slate dark with a Blue-400 anchor.",
    previewColors: { bg: "#0f172a", accent: "#60a5fa", fg: "#e2e8f0" },
  },
  {
    id: "graphite",
    label: "Graphite",
    family: "light",
    description: "Neutral grey, low-chroma light theme.",
    previewColors: { bg: "#f0f0f0", accent: "#606060", fg: "#1a1a1a" },
  },
  {
    id: "soft-pop",
    label: "Soft Pop",
    family: "dark",
    description: "Indigo accent on pure black.",
    previewColors: { bg: "#000000", accent: "#818cf8", fg: "#f4f4f8" },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    family: "dark",
    description: "Yellow on black for maximum legibility (a11y).",
    previewColors: { bg: "#000000", accent: "#ffff00", fg: "#ffffff" },
  },
  {
    id: "ocean",
    label: "Ocean",
    family: "dark",
    description: "Sky accent on deep navy.",
    previewColors: { bg: "#0b1f33", accent: "#38bdf8", fg: "#e6f1fb" },
  },
];

/** The theme applied when nothing is stored and no OS hint resolves. */
export const DEFAULT_THEME: ThemeId = "light";

const BY_ID: ReadonlyMap<string, Theme> = new Map(
  THEMES.map((theme) => [theme.id, theme]),
);

/** True when `id` is a real theme id (guards stale localStorage values). */
export function isKnownTheme(id: string | null | undefined): id is ThemeId {
  return id != null && BY_ID.has(id);
}

/** The theme record for `id`, or the default theme when unknown. */
export function getTheme(id: string | null | undefined): Theme {
  return (id != null && BY_ID.get(id)) || BY_ID.get(DEFAULT_THEME)!;
}

/** The light/dark family that `id` belongs to (drives `data-theme`). */
export function familyOf(id: string | null | undefined): ThemeFamily {
  return getTheme(id).family;
}

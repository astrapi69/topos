import { useEffect, useState } from "react";

import {
  DEFAULT_THEME,
  familyOf,
  isKnownTheme,
  type ThemeFamily,
  type ThemeId,
} from "../themes/themes";

const STORAGE_KEY = "topos-app-theme";
// Pre-multi-theme key: held "light" | "dark". Read once for migration so an
// existing install keeps its light/dark choice on first load after the swap.
const LEGACY_LIGHT_DARK_KEY = "topos-theme";

function getInitialTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isKnownTheme(stored)) return stored;
  // Migrate the old light/dark key (its values are valid theme ids).
  const legacy = localStorage.getItem(LEGACY_LIGHT_DARK_KEY);
  if (isKnownTheme(legacy)) return legacy;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return DEFAULT_THEME;
}

/**
 * Theme state. `theme` is the chosen theme id; `family` is its light/dark
 * class. The effect writes BOTH attributes on <html>: `data-theme` (family,
 * for the Tailwind `dark:` variant) and `data-app-theme` (identity, for the
 * per-theme token blocks). Mirrors the pre-paint IIFE in index.html.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getInitialTheme);
  const family: ThemeFamily = familyOf(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", family);
    root.setAttribute("data-app-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, family]);

  const setTheme = (next: ThemeId) => setThemeState(next);

  // Quick light/dark flip (kept for the interim Settings toggle): jump to
  // the base theme of the opposite family.
  const toggle = () =>
    setThemeState((current) =>
      familyOf(current) === "dark" ? "light" : "dark",
    );

  return { theme, family, setTheme, toggle };
}

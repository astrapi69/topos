/**
 * Palette registry. Topos ships a single palette - the default
 * light/dark pair in ``styles/global.css`` (``:root`` +
 * ``[data-theme="dark"]``). There is no palette picker and none is
 * planned (one anchor colour, done); the five template palettes from
 * the bibliogon lineage were removed 2026-07-18.
 *
 * The registry survives as the guard for persisted
 * ``localStorage["topos-app-theme"]`` values: unknown ids (including
 * the removed template palettes) fall back to the default in
 * ``hooks/useTheme.ts``.
 */

export interface Palette {
    id: string;
    label: string;
}

export const PALETTES: readonly Palette[] = [
    // The id predates the 2026-07 token unification; it stays stable
    // so persisted localStorage values keep resolving.
    {id: "warm-literary", label: "Standard"},
];

export const DEFAULT_PALETTE = "warm-literary";

export function isKnownPalette(id: string): boolean {
    return PALETTES.some((p) => p.id === id);
}

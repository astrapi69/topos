/**
 * Shared navigation model for the Settings page.
 *
 * One `SidebarGroup[]` drives BOTH the desktop sidebar
 * ({@link ../components/settings/SettingsSidebar}) and the mobile menu
 * ({@link ../components/settings/SettingsMobileMenu}), so the two
 * surfaces cannot drift apart. Adapted from adaptive-learner, trimmed to
 * what Topos needs: no danger group (Settings holds nothing destructive
 * beyond the cache reset, which lives inside its own panel).
 *
 * "Cannot drift" is enforced, not asserted: `settingsNavParity.test.tsx`
 * renders both surfaces from one fixture and pins that each exposes the
 * same set of item values. The two do NOT share a testid scheme -
 * desktop uses {@link SidebarItem.testId}, mobile derives
 * `settings-mobile-tab-${value}` - so parity is keyed on `value`, the
 * one field both renderers consume.
 *
 * @example
 * const groups: SidebarGroup[] = [
 *   { key: "app", label: t("...", "App"), items: [
 *     { value: "general", label: t("...", "Allgemein"), testId: "settings-tab-general" },
 *   ]},
 * ];
 */

/** A single navigable tab. */
export interface SidebarItem {
  /** Tab key, e.g. `"general"` - drives `?tab=` and the rendered panel. */
  value: string;
  /** Already-i18n-resolved label. */
  label: string;
  /** `data-testid` for the DESKTOP item; mobile derives its own. */
  testId: string;
}

/** A labelled group of tabs. */
export interface SidebarGroup {
  /** Stable group key (testid, React key). */
  key: string;
  items: SidebarItem[];
  /** Optional group header (uppercase, muted). */
  label?: string;
}

/** Props shared by both navigation surfaces. */
export interface SettingsNavProps {
  groups: SidebarGroup[];
  activeTab: string;
  onChange: (next: string) => void;
}

/** Every item value across all groups, in display order. */
export function navValues(groups: SidebarGroup[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.value));
}

/**
 * The tab to show: the requested one when it exists, else the first.
 * Keeps a stale `?tab=` from a bookmark (or a removed tab) from
 * rendering an empty panel.
 */
export function resolveTab(
  groups: SidebarGroup[],
  requested: string | null,
): string {
  const values = navValues(groups);
  return requested && values.includes(requested)
    ? requested
    : (values[0] ?? "");
}

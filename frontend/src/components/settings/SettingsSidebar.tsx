/**
 * SettingsSidebar - the desktop Settings navigation.
 *
 * Pure and presentational: takes the shared `SidebarGroup[]` model plus
 * the active tab and an `onChange` callback, and knows nothing about
 * routing or storage. A grouped `<nav>` with uppercase muted group
 * headers and full-width 44px buttons; the active item gets the accent
 * colour, bold weight, and `aria-current="page"`.
 *
 * Hidden below `md` - the mobile surface is {@link SettingsMobileMenu}.
 *
 * @example
 * <SettingsSidebar groups={groups} activeTab={tab} onChange={setTab} />
 */

import { useI18n } from "../../hooks/useI18n";
import type { SettingsNavProps } from "../../settings/sidebarModel";

export default function SettingsSidebar({
  groups,
  activeTab,
  onChange,
}: SettingsNavProps) {
  const { t } = useI18n();
  return (
    <nav
      className="hidden md:block md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto"
      aria-label={t("topos.page.settings.nav_aria", "Einstellungs-Navigation")}
      data-testid="settings-tabs"
    >
      {groups.map((group) => (
        <div
          key={group.key}
          data-testid={`settings-group-${group.key}`}
          className="mb-4"
        >
          {group.label && (
            <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {group.label}
            </h2>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {group.items.map((item) => {
              const active = item.value === activeTab;
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => onChange(item.value)}
                    aria-current={active ? "page" : undefined}
                    data-testid={item.testId}
                    className={`block w-full min-h-11 rounded border-0 py-2 pl-3 pr-2 text-left text-sm cursor-pointer hover:bg-surface-hover ${
                      active
                        ? "bg-surface-2 font-semibold text-accent"
                        : "bg-transparent text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

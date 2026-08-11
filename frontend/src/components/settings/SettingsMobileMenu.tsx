/**
 * SettingsMobileMenu - the mobile Settings navigation.
 *
 * A trigger showing a menu icon plus the active tab label, opening an
 * anchored popover that lists the same shared `SidebarGroup[]` the
 * desktop sidebar uses. Closes on select, outside click, and Escape;
 * the active item carries a check icon. Shown only below `md`.
 *
 * Deliberately not a Radix DropdownMenu: the menu is the page's primary
 * navigation, and Radix's portal makes it untestable under happy-dom
 * (see lessons-learned "Radix DropdownMenu + happy-dom is brittle").
 * A plain popover keeps both surfaces coverable by the parity test.
 *
 * @example
 * <SettingsMobileMenu groups={groups} activeTab={tab} onChange={setTab} />
 */

import { useEffect, useRef, useState } from "react";
import { Check, Menu } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import type { SettingsNavProps } from "../../settings/sidebarModel";
import { btn, card } from "../../ui/classes";

export default function SettingsMobileMenu({
  groups,
  activeTab,
  onChange,
}: SettingsNavProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLabel =
    groups
      .flatMap((group) => group.items)
      .find((item) => item.value === activeTab)?.label ??
    t("topos.page.settings.title", "Einstellungen");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative md:hidden mb-4">
      <button
        type="button"
        className={`${btn} w-full justify-between`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="settings-mobile-trigger"
      >
        <span className="flex items-center gap-2">
          <Menu size={16} aria-hidden />
          {activeLabel}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t(
            "topos.page.settings.nav_aria",
            "Einstellungs-Navigation",
          )}
          className={`${card} absolute left-0 right-0 z-40 mt-1 flex flex-col gap-1 p-2 shadow-lg`}
          data-testid="settings-mobile-menu"
        >
          {groups.map((group) => (
            <div key={group.key}>
              {group.label && (
                <span className="block px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.label}
                </span>
              )}
              {group.items.map((item) => {
                const active = item.value === activeTab;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    aria-current={active ? "page" : undefined}
                    data-testid={`settings-mobile-tab-${item.value}`}
                    className={`flex w-full min-h-11 items-center gap-2 rounded border-0 px-3 py-2 text-left text-sm cursor-pointer hover:bg-surface-hover ${
                      active
                        ? "bg-surface-2 font-semibold text-accent"
                        : "bg-transparent text-ink"
                    }`}
                  >
                    {active ? (
                      <Check size={14} aria-hidden />
                    ) : (
                      <span className="w-[14px]" aria-hidden />
                    )}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Navigation shared by every Topos page.
 *
 * From `md` up: a slim top bar carries the destinations as inline links
 * plus a search trigger. Below `md` (phone): the same top bar shows the
 * brand and a single hamburger button on the right; tapping it drops
 * down a menu with every destination and a search entry. There is no
 * bottom tab bar (removed 2026-08-08 on user request - a phone in the
 * basement gets one top menu, not a thumb bar). The desktop links stay
 * in the DOM at every width (Tailwind `hidden` only sets display:none),
 * so the `nav-*` test ids keep resolving.
 *
 * Testid namespace: top bar `nav-{route}`, hamburger `nav-hamburger`,
 * mobile dropdown `nav-mobile-menu` with `nav-{route}-mobile` per entry
 * plus `nav-search-mobile`.
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive,
  Camera,
  FileUp,
  FolderTree,
  House,
  ListTodo,
  Menu,
  Search,
  Settings,
} from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import GlobalSearch from "./GlobalSearch";

interface NavLink {
  to: string;
  labelKey: string;
  fallback: string;
  testId: string;
  icon: typeof House;
}

/** Every destination, in menu order (top-bar links + mobile dropdown). */
const NAV_LINKS: NavLink[] = [
  {
    to: "/",
    labelKey: "topos.nav.dashboard",
    fallback: "Dashboard",
    testId: "nav-dashboard",
    icon: House,
  },
  {
    to: "/containers",
    labelKey: "topos.nav.containers",
    fallback: "Container",
    testId: "nav-containers",
    icon: Archive,
  },
  {
    to: "/photo-intake",
    labelKey: "topos.nav.photo_intake",
    fallback: "Foto-Erfassung",
    testId: "nav-photo-intake",
    icon: Camera,
  },
  {
    to: "/categories",
    labelKey: "topos.nav.categories",
    fallback: "Kategorien",
    testId: "nav-categories",
    icon: FolderTree,
  },
  {
    to: "/actions",
    labelKey: "topos.nav.actions",
    fallback: "Aktionen",
    testId: "nav-actions",
    icon: ListTodo,
  },
  {
    to: "/import",
    labelKey: "topos.nav.import",
    fallback: "Import",
    testId: "nav-import",
    icon: FileUp,
  },
  {
    to: "/settings",
    labelKey: "topos.nav.settings",
    fallback: "Einstellungen",
    testId: "nav-settings",
    icon: Settings,
  },
];

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

const activeCls = "no-underline font-semibold text-accent";
const inactiveCls = "no-underline text-ink-secondary hover:text-ink";

export default function NavBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useKeyboardShortcuts([
    { keys: "mod+k", handler: () => setSearchOpen(true) },
    { keys: "/", handler: () => setSearchOpen(true) },
  ]);

  return (
    <>
      <nav
        data-testid="topos-navbar"
        // relative z-40 keeps the open dropdown above the tap-away backdrop.
        className="relative z-40 bg-surface-2 border-b border-line"
      >
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
          <strong className="mr-1 sm:mr-2 font-bold text-ink font-display">
            {t("topos.app.name", "Topos")}
          </strong>

          {/* Desktop links: horizontal from md up. */}
          <div className="hidden md:flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                data-testid={link.testId}
                className={
                  isActive(pathname, link.to) ? activeCls : inactiveCls
                }
              >
                {t(link.labelKey, link.fallback)}
              </Link>
            ))}
          </div>

          {/* Desktop search trigger. */}
          <button
            type="button"
            data-testid="nav-search"
            onClick={() => setSearchOpen(true)}
            aria-label={t("topos.nav.search", "Suchen")}
            title={t("topos.nav.search", "Suchen")}
            className="ml-auto hidden md:inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink-secondary hover:text-ink cursor-pointer"
          >
            <Search size={16} aria-hidden />
            <span>{t("topos.nav.search", "Suchen")}</span>
            <kbd className="rounded border border-line px-1 text-xs">
              Ctrl K
            </kbd>
          </button>

          {/* Mobile hamburger: opens the dropdown menu below the bar. */}
          <button
            type="button"
            data-testid="nav-hamburger"
            aria-label={t("topos.nav.menu", "Menü")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="ml-auto md:hidden inline-flex items-center justify-center rounded border border-line bg-surface p-2 min-h-[44px] min-w-[44px] text-ink-secondary hover:text-ink cursor-pointer"
          >
            <Menu size={22} aria-hidden />
          </button>
        </div>

        {/* Mobile dropdown: every destination + search, below the top bar. */}
        {menuOpen && (
          <div
            data-testid="nav-mobile-menu"
            className="md:hidden border-t border-line bg-surface px-2 py-2 flex flex-col gap-1"
          >
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  data-testid={`${link.testId}-mobile`}
                  aria-current={
                    isActive(pathname, link.to) ? "page" : undefined
                  }
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded px-3 py-3 min-h-[44px] ${
                    isActive(pathname, link.to) ? activeCls : inactiveCls
                  }`}
                >
                  <Icon size={18} aria-hidden />
                  {t(link.labelKey, link.fallback)}
                </Link>
              );
            })}
            <button
              type="button"
              data-testid="nav-search-mobile"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
              className={`flex items-center gap-3 rounded px-3 py-3 min-h-[44px] bg-transparent border-0 cursor-pointer ${inactiveCls}`}
            >
              <Search size={18} aria-hidden />
              {t("topos.nav.search", "Suchen")}
            </button>
          </div>
        )}
      </nav>

      {/* Tap-away backdrop for the mobile menu. */}
      {menuOpen && (
        <div
          data-testid="nav-menu-backdrop"
          aria-hidden
          onClick={() => setMenuOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/30"
        />
      )}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

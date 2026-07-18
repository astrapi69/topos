/**
 * Top-of-page navigation shared by every Topos page.
 *
 * Mobile-first: on narrow screens the links collapse behind a hamburger
 * toggle (`md:hidden`) that opens a stacked, full-width menu with large
 * touch targets; from `md` up the links render as a horizontal bar. The
 * desktop links stay in the DOM at every width (Tailwind `hidden` only
 * sets display:none), so the existing `nav-*` test ids keep resolving.
 */

import {useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {Menu, Search, X} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import {useKeyboardShortcuts} from "../hooks/useKeyboardShortcuts";
import GlobalSearch from "./GlobalSearch";

interface NavLink {
    to: string;
    labelKey: string;
    fallback: string;
    testId: string;
}

const LINKS: NavLink[] = [
    {to: "/", labelKey: "topos.nav.dashboard", fallback: "Dashboard", testId: "nav-dashboard"},
    {
        to: "/containers",
        labelKey: "topos.nav.containers",
        fallback: "Container",
        testId: "nav-containers",
    },
    {
        to: "/categories",
        labelKey: "topos.nav.categories",
        fallback: "Kategorien",
        testId: "nav-categories",
    },
    {to: "/actions", labelKey: "topos.nav.actions", fallback: "Aktionen", testId: "nav-actions"},
    {to: "/import", labelKey: "topos.nav.import", fallback: "Import", testId: "nav-import"},
    {
        to: "/photo-intake",
        labelKey: "topos.nav.photo_intake",
        fallback: "Foto-Erfassung",
        testId: "nav-photo-intake",
    },
    {
        to: "/settings",
        labelKey: "topos.nav.settings",
        fallback: "Einstellungen",
        testId: "nav-settings",
    },
];

function isActive(pathname: string, to: string): boolean {
    return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

const activeCls = "no-underline font-semibold text-accent";
const inactiveCls = "no-underline text-ink-secondary hover:text-ink";

export default function NavBar() {
    const {t} = useI18n();
    const {pathname} = useLocation();
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useKeyboardShortcuts([
        {keys: "mod+k", handler: () => setSearchOpen(true)},
        {keys: "/", handler: () => setSearchOpen(true)},
    ]);

    return (
        <nav
            data-testid="topos-navbar"
            className="bg-surface-2 border-b border-line"
        >
            <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
                <strong className="mr-1 sm:mr-2 font-bold text-ink">
                    {t("topos.app.name", "Topos")}
                </strong>

                {/* Desktop links: horizontal from md up. */}
                <div className="hidden md:flex items-center gap-4">
                    {LINKS.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            data-testid={link.testId}
                            className={isActive(pathname, link.to) ? activeCls : inactiveCls}
                        >
                            {t(link.labelKey, link.fallback)}
                        </Link>
                    ))}
                </div>

                <button
                    type="button"
                    data-testid="nav-search"
                    onClick={() => setSearchOpen(true)}
                    aria-label={t("topos.nav.search", "Suchen")}
                    title={t("topos.nav.search", "Suchen")}
                    className="ml-auto inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink-secondary hover:text-ink cursor-pointer"
                >
                    <Search size={16} aria-hidden />
                    <span className="hidden sm:inline">{t("topos.nav.search", "Suchen")}</span>
                    <kbd className="hidden sm:inline rounded border border-line px-1 text-xs">
                        Ctrl K
                    </kbd>
                </button>

                {/* Hamburger: mobile only. */}
                <button
                    type="button"
                    data-testid="nav-menu-toggle"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-label={t("topos.nav.menu", "Menü")}
                    aria-expanded={menuOpen}
                    className="md:hidden inline-flex items-center justify-center rounded border border-line bg-surface p-2 text-ink-secondary cursor-pointer"
                >
                    {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
                </button>
            </div>

            {/* Mobile menu: stacked, full-width, large touch targets. */}
            {menuOpen && (
                <div
                    data-testid="nav-mobile-menu"
                    className="md:hidden flex flex-col gap-1 border-t border-line px-2 pb-2"
                >
                    {LINKS.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            data-testid={`${link.testId}-mobile`}
                            onClick={() => setMenuOpen(false)}
                            className={`block rounded px-3 py-3 ${
                                isActive(pathname, link.to) ? activeCls : inactiveCls
                            }`}
                        >
                            {t(link.labelKey, link.fallback)}
                        </Link>
                    ))}
                </div>
            )}

            {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
        </nav>
    );
}

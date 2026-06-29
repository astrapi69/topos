/**
 * Top-of-page navigation shared by every Topos page.
 *
 * Light shell, no Radix primitives - the goal is to keep the app
 * navigable while Phase 6 ships. A future polish pass can promote
 * this to a full layout with theme toggles, breadcrumbs, etc.
 */

import {useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {Search} from "lucide-react";

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
        to: "/settings",
        labelKey: "topos.nav.settings",
        fallback: "Einstellungen",
        testId: "nav-settings",
    },
];

export default function NavBar() {
    const {t} = useI18n();
    const {pathname} = useLocation();
    const [searchOpen, setSearchOpen] = useState(false);

    useKeyboardShortcuts([
        {keys: "mod+k", handler: () => setSearchOpen(true)},
        {keys: "/", handler: () => setSearchOpen(true)},
    ]);

    return (
        <nav
            data-testid="topos-navbar"
            className="flex items-center gap-4 px-5 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700"
        >
            <strong className="mr-2 font-bold text-gray-900 dark:text-gray-100">
                {t("topos.app.name", "Topos")}
            </strong>
            {LINKS.map((link) => {
                const active = link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
                return (
                    <Link
                        key={link.to}
                        to={link.to}
                        data-testid={link.testId}
                        className={
                            active
                                ? "no-underline font-semibold text-blue-600 dark:text-blue-400"
                                : "no-underline text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                        }
                    >
                        {t(link.labelKey, link.fallback)}
                    </Link>
                );
            })}
            <button
                type="button"
                data-testid="nav-search"
                onClick={() => setSearchOpen(true)}
                aria-label={t("topos.nav.search", "Suchen")}
                title={t("topos.nav.search", "Suchen")}
                className="ml-auto inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
            >
                <Search size={16} aria-hidden />
                <span className="hidden sm:inline">{t("topos.nav.search", "Suchen")}</span>
                <kbd className="hidden sm:inline rounded border border-gray-300 dark:border-gray-600 px-1 text-xs">
                    Ctrl K
                </kbd>
            </button>
            {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
        </nav>
    );
}

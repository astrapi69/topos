/**
 * Navigation shared by every Topos page.
 *
 * Mobile-first: the primary destinations live in a fixed bottom tab
 * bar (thumb-reachable for one-handed use - the main scenario is a
 * phone in the basement), secondary destinations sit behind a "Mehr"
 * sheet that opens above the bar. From `md` up the tab bar disappears
 * and a slim top bar carries the inline links. The desktop links stay
 * in the DOM at every width (Tailwind `hidden` only sets
 * display:none), so the existing `nav-*` test ids keep resolving.
 *
 * Testid namespace: top bar `nav-{route}`, tab bar `nav-tab-{route}`,
 * Mehr sheet `nav-more-menu` + `nav-{route}-mobile` per entry.
 */

import {useState} from "react";
import {Link, useLocation} from "react-router-dom";
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

import {useI18n} from "../hooks/useI18n";
import {useKeyboardShortcuts} from "../hooks/useKeyboardShortcuts";
import GlobalSearch from "./GlobalSearch";

interface NavLink {
    to: string;
    labelKey: string;
    fallback: string;
    testId: string;
    icon: typeof House;
}

/** Primary destinations: rendered as bottom tabs on mobile. */
const PRIMARY_LINKS: NavLink[] = [
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
];

/** Secondary destinations: behind the "Mehr" sheet on mobile. */
const SECONDARY_LINKS: NavLink[] = [
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

const DESKTOP_LINKS: NavLink[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS];

function isActive(pathname: string, to: string): boolean {
    return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

const activeCls = "no-underline font-semibold text-accent";
const inactiveCls = "no-underline text-ink-secondary hover:text-ink";

const tabBase =
    "flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] " +
    "no-underline text-[11px] leading-tight cursor-pointer bg-transparent border-0";
const tabActive = `${tabBase} text-accent font-semibold`;
const tabInactive = `${tabBase} text-ink-muted`;

export default function NavBar() {
    const {t} = useI18n();
    const {pathname} = useLocation();
    const [searchOpen, setSearchOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    useKeyboardShortcuts([
        {keys: "mod+k", handler: () => setSearchOpen(true)},
        {keys: "/", handler: () => setSearchOpen(true)},
    ]);

    const moreActive = SECONDARY_LINKS.some((link) => isActive(pathname, link.to));

    return (
        <>
            <nav
                data-testid="topos-navbar"
                className="bg-surface-2 border-b border-line"
            >
                <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
                    <strong className="mr-1 sm:mr-2 font-bold text-ink font-display">
                        {t("topos.app.name", "Topos")}
                    </strong>

                    {/* Desktop links: horizontal from md up. */}
                    <div className="hidden md:flex items-center gap-4">
                        {DESKTOP_LINKS.map((link) => (
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

                    {/* Desktop search trigger; mobile searches via the tab bar. */}
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
                        <kbd className="rounded border border-line px-1 text-xs">Ctrl K</kbd>
                    </button>
                </div>
            </nav>

            {/* Mobile bottom tab bar. */}
            <nav
                data-testid="topos-tabbar"
                className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface-2 pb-[env(safe-area-inset-bottom)]"
            >
                <div className="grid grid-cols-5">
                    {PRIMARY_LINKS.map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                data-testid={`nav-tab-${link.testId.slice("nav-".length)}`}
                                aria-current={isActive(pathname, link.to) ? "page" : undefined}
                                className={isActive(pathname, link.to) ? tabActive : tabInactive}
                                onClick={() => setMoreOpen(false)}
                            >
                                <Icon size={20} aria-hidden />
                                {t(link.labelKey, link.fallback)}
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        data-testid="nav-tab-search"
                        onClick={() => {
                            setMoreOpen(false);
                            setSearchOpen(true);
                        }}
                        className={tabInactive}
                    >
                        <Search size={20} aria-hidden />
                        {t("topos.nav.search", "Suchen")}
                    </button>
                    <button
                        type="button"
                        data-testid="nav-tab-more"
                        aria-expanded={moreOpen}
                        onClick={() => setMoreOpen((open) => !open)}
                        className={moreActive ? tabActive : tabInactive}
                    >
                        <Menu size={20} aria-hidden />
                        {t("topos.nav.more", "Mehr")}
                    </button>
                </div>
            </nav>

            {/* "Mehr" sheet: secondary destinations above the tab bar. */}
            {moreOpen && (
                <>
                    <div
                        data-testid="nav-more-backdrop"
                        aria-hidden
                        onClick={() => setMoreOpen(false)}
                        className="md:hidden fixed inset-0 z-40 bg-black/30"
                    />
                    <div
                        data-testid="nav-more-menu"
                        className="md:hidden fixed inset-x-2 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg"
                    >
                        {SECONDARY_LINKS.map((link) => {
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    data-testid={`${link.testId}-mobile`}
                                    onClick={() => setMoreOpen(false)}
                                    className={`flex items-center gap-3 rounded px-3 py-3 ${
                                        isActive(pathname, link.to) ? activeCls : inactiveCls
                                    }`}
                                >
                                    <Icon size={18} aria-hidden />
                                    {t(link.labelKey, link.fallback)}
                                </Link>
                            );
                        })}
                    </div>
                </>
            )}

            {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
        </>
    );
}

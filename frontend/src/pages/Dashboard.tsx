/**
 * Dashboard landing page.
 *
 * Shows total counts for the four entities plus a global client-side
 * full-text search (MiniSearch over the Dexie cache) that routes hits to
 * the relevant detail view.
 */

import {useEffect, useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Clock, FileText, Folder} from "lucide-react";

import NavBar from "../components/NavBar";
import {useActions, useCategories, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {rebuildSearchIndex} from "../search/buildIndex";
import {useSearch, type SearchResult} from "../search/useSearch";
import {input, muted} from "../ui/classes";

export default function Dashboard() {
    const {t} = useI18n();
    const containers = useContainers();
    const items = useItems();
    const categories = useCategories();
    const openActions = useActions({status: "open"});
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState("");
    const results = useSearch(searchTerm);

    // Keep the search index in sync with the cached data. Rebuilding is
    // cheap (hundreds of docs) and only happens when the cache changes.
    useEffect(() => {
        void rebuildSearchIndex();
    }, [containers.data, items.data, openActions.data]);

    const containerById = useMemo(
        () => new Map(containers.data.map((c) => [c.id, c])),
        [containers.data],
    );
    const itemById = useMemo(() => new Map(items.data.map((i) => [i.id, i])), [items.data]);

    function subtitleFor(r: SearchResult): string {
        if (r.type === "item") {
            const label = r.containerId != null ? containerById.get(r.containerId)?.label : undefined;
            return [label, r.secondary].filter(Boolean).join(" · ");
        }
        if (r.type === "action") {
            const content = r.itemId != null ? itemById.get(r.itemId)?.content : undefined;
            const status = r.secondary ? t(`topos.action.status.${r.secondary}`, r.secondary) : "";
            return [content, status].filter(Boolean).join(" · ");
        }
        return r.secondary;
    }

    function goTo(r: SearchResult): void {
        if (r.type === "container") navigate(`/containers/${r.refId}`);
        else if (r.type === "item" && r.containerId != null) navigate(`/containers/${r.containerId}#item-${r.refId}`);
        else navigate("/actions");
    }

    function iconFor(type: SearchResult["type"]) {
        if (type === "container") return <Folder size={16} aria-hidden />;
        if (type === "item") return <FileText size={16} aria-hidden />;
        return <Clock size={16} aria-hidden />;
    }

    const trimmed = searchTerm.trim();

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <h1 data-testid="dashboard-title">
                    {t("topos.page.dashboard.title", "Übersicht")}
                </h1>

                <section
                    data-testid="dashboard-counts"
                    style={{display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap"}}
                >
                    <Stat
                        label={t("topos.nav.containers", "Container")}
                        value={containers.data.length}
                        href="/containers"
                        testId="stat-containers"
                    />
                    <Stat
                        label={t("topos.page.dashboard.items", "Einträge")}
                        value={items.data.length}
                        href="/containers"
                        testId="stat-items"
                    />
                    <Stat
                        label={t("topos.page.dashboard.categories", "Kategorien")}
                        value={categories.data.length}
                        href="/categories"
                        testId="stat-categories"
                    />
                    <Stat
                        label={t("topos.page.dashboard.open_actions", "Offene Aktionen")}
                        value={openActions.data.length}
                        href="/actions"
                        testId="stat-actions"
                    />
                </section>

                <section style={{marginBottom: "1.5rem"}}>
                    <h2>{t("topos.page.dashboard.search", "Suche")}</h2>
                    <input
                        type="search"
                        className={`${input} w-full max-w-xl`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t(
                            "topos.page.dashboard.search_placeholder",
                            "Container, Einträge, Aktionen durchsuchen...",
                        )}
                        data-testid="dashboard-search-input"
                    />

                    {trimmed.length > 0 && (
                        <div data-testid="dashboard-search-count" className={`${muted} mt-2 text-sm`}>
                            {t("topos.page.dashboard.result_count", "{count} Ergebnisse").replace(
                                "{count}",
                                String(results.length),
                            )}
                        </div>
                    )}

                    {trimmed.length > 0 && results.length === 0 && (
                        <p data-testid="dashboard-search-empty" className={`${muted} mt-2`}>
                            {t("topos.page.dashboard.no_results", "Keine Treffer")}
                        </p>
                    )}

                    {results.length > 0 && (
                        <ul data-testid="dashboard-search-results" className="mt-2 max-w-xl">
                            {results.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => goTo(r)}
                                        data-testid={`search-hit-${r.type}-${r.refId}`}
                                        className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                    >
                                        <span className="text-gray-500 dark:text-gray-400 shrink-0">
                                            {iconFor(r.type)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-gray-900 dark:text-gray-100">
                                                {r.displayTitle}
                                            </span>
                                            {subtitleFor(r) && (
                                                <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
                                                    {subtitleFor(r)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </>
    );
}

function Stat({
    label,
    value,
    href,
    testId,
}: {
    label: string;
    value: number;
    href: string;
    testId: string;
}) {
    return (
        <Link
            to={href}
            data-testid={testId}
            className="flex flex-col rounded border border-gray-300 dark:border-gray-700 no-underline text-inherit"
            style={{padding: "1rem 1.25rem", minWidth: 140}}
        >
            <span className={muted} style={{fontSize: "0.875rem"}}>{label}</span>
            <span style={{fontSize: "2rem", fontWeight: 600}}>{value}</span>
        </Link>
    );
}

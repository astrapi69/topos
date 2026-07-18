/**
 * Dashboard landing page.
 *
 * Shows total counts for the four entities plus a global client-side
 * full-text search (MiniSearch over the Dexie cache) that routes hits to
 * the relevant detail view.
 */

import {useEffect, useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useActions, useCategories, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {rebuildSearchIndex} from "../search/buildIndex";
import SearchResults from "../search/SearchResults";
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

    function goTo(r: SearchResult): void {
        if (r.type === "container") navigate(`/containers/${r.refId}`);
        else if (r.type === "item" && r.containerId != null) navigate(`/containers/${r.containerId}#item-${r.refId}`);
        else navigate("/actions");
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
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
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
                        <div className="mt-2 max-w-xl">
                            <SearchResults
                                results={results}
                                containerById={containerById}
                                itemById={itemById}
                                onSelect={goTo}
                            />
                        </div>
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
            className="flex flex-col rounded border border-line bg-surface no-underline text-inherit"
            style={{padding: "1rem 1.25rem", minWidth: 140}}
        >
            <span className={muted} style={{fontSize: "0.875rem"}}>{label}</span>
            <span style={{fontSize: "2rem", fontWeight: 600}}>{value}</span>
        </Link>
    );
}

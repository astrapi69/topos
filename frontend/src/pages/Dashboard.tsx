/**
 * Dashboard landing page.
 *
 * Shows total counts for the four entities plus a global
 * full-text search input that routes hits into ContainerDetail
 * via the item's container.
 */

import {useState} from "react";
import {Link, useNavigate} from "react-router-dom";

import NavBar from "../components/NavBar";
import {api} from "../api/client";
import {useActions, useCategories, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import type {Item} from "../types/topos";

export default function Dashboard() {
    const {t} = useI18n();
    const containers = useContainers();
    const items = useItems();
    const categories = useCategories();
    const openActions = useActions({status: "open"});
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [searching, setSearching] = useState(false);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        const q = searchTerm.trim();
        if (q.length === 0) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const rows = await api.items.search(q);
            setSearchResults(rows);
        } finally {
            setSearching(false);
        }
    }

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
                    <form onSubmit={handleSearch} style={{display: "flex", gap: "0.5rem"}}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t(
                                "topos.page.dashboard.search_placeholder",
                                "Suche im Inhalt, in Notizen, in Kategorien...",
                            )}
                            data-testid="dashboard-search-input"
                            style={{flex: 1, padding: "0.5rem"}}
                        />
                        <button
                            type="submit"
                            data-testid="dashboard-search-submit"
                            disabled={searching}
                        >
                            {searching
                                ? t("topos.page.dashboard.searching", "Suche...")
                                : t("topos.page.dashboard.search", "Suchen")}
                        </button>
                    </form>
                    {searchResults.length > 0 && (
                        <ul data-testid="dashboard-search-results" style={{marginTop: "0.75rem"}}>
                            {searchResults.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/containers/${item.containerId}`)}
                                        data-testid={`search-hit-${item.id}`}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            padding: "0.25rem 0",
                                            color: "#0066cc",
                                            textDecoration: "underline",
                                        }}
                                    >
                                        {item.content}
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
            style={{
                display: "flex",
                flexDirection: "column",
                padding: "1rem 1.25rem",
                border: "1px solid #ddd",
                borderRadius: 6,
                textDecoration: "none",
                color: "inherit",
                minWidth: 140,
            }}
        >
            <span style={{fontSize: "0.875rem", color: "#666"}}>{label}</span>
            <span style={{fontSize: "2rem", fontWeight: 600}}>{value}</span>
        </Link>
    );
}

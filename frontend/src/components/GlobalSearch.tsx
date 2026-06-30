/**
 * Global "spotlight" search modal, opened from the NavBar (button or
 * Ctrl/Cmd+K or "/"). Mounted only while open, so its data hooks do not
 * fetch on every page. Rebuilds the MiniSearch index from the cache as
 * the cached data arrives, then queries it live.
 */

import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Search} from "lucide-react";

import {useActions, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {rebuildSearchIndex} from "../search/buildIndex";
import SearchResults from "../search/SearchResults";
import {useSearch, type SearchResult} from "../search/useSearch";
import {input, muted} from "../ui/classes";

export default function GlobalSearch({onClose}: {onClose: () => void}) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const containers = useContainers();
    const items = useItems();
    const actions = useActions({});
    const [query, setQuery] = useState("");
    const results = useSearch(query);
    const inputRef = useRef<HTMLInputElement>(null);

    const containerById = useMemo(
        () => new Map(containers.data.map((c) => [c.id, c])),
        [containers.data],
    );
    const itemById = useMemo(() => new Map(items.data.map((i) => [i.id, i])), [items.data]);

    // Rebuild the index whenever the cached data changes (e.g. the SWR
    // hooks above settle right after the modal opens).
    useEffect(() => {
        void rebuildSearchIndex();
    }, [containers.data, items.data, actions.data]);

    // Focus the input on open.
    useEffect(() => {
        const handle = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(handle);
    }, []);

    // Escape closes.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function select(r: SearchResult): void {
        if (r.type === "container") navigate(`/containers/${r.refId}`);
        else if (r.type === "item" && r.containerId != null) navigate(`/containers/${r.containerId}#item-${r.refId}`);
        else navigate("/actions");
        onClose();
    }

    const trimmed = query.trim();

    return (
        <div
            data-testid="global-search-overlay"
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-xl rounded-lg border border-gray-300 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <Search size={18} className="shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
                    <input
                        ref={inputRef}
                        type="search"
                        className={`${input} w-full`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t(
                            "topos.page.dashboard.search_placeholder",
                            "Container, Einträge, Aktionen durchsuchen...",
                        )}
                        data-testid="global-search-input"
                    />
                </div>

                {trimmed.length > 0 && (
                    <div data-testid="global-search-count" className={`${muted} mt-2 text-sm`}>
                        {t("topos.page.dashboard.result_count", "{count} Ergebnisse").replace(
                            "{count}",
                            String(results.length),
                        )}
                    </div>
                )}
                {trimmed.length > 0 && results.length === 0 && (
                    <p data-testid="global-search-empty" className={`${muted} mt-2`}>
                        {t("topos.page.dashboard.no_results", "Keine Treffer")}
                    </p>
                )}
                {results.length > 0 && (
                    <div className="mt-2 max-h-80 overflow-y-auto">
                        <SearchResults
                            results={results}
                            containerById={containerById}
                            itemById={itemById}
                            onSelect={select}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

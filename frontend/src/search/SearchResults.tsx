/**
 * Presentational search-results list, shared by the Dashboard search and
 * the global (NavBar) spotlight search. Renders a Lucide icon per hit
 * type, the title, and a type-specific subtitle; a click invokes onSelect.
 */

import {Clock, FileText, Folder} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import type {Container, Item} from "../types/topos";
import type {SearchResult} from "./useSearch";

function iconFor(type: SearchResult["type"]) {
    if (type === "container") return <Folder size={16} aria-hidden />;
    if (type === "item") return <FileText size={16} aria-hidden />;
    return <Clock size={16} aria-hidden />;
}

export default function SearchResults({
    results,
    containerById,
    itemById,
    onSelect,
}: {
    results: SearchResult[];
    containerById: Map<number, Container>;
    itemById: Map<number, Item>;
    onSelect: (result: SearchResult) => void;
}) {
    const {t} = useI18n();

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

    return (
        <ul data-testid="search-results">
            {results.map((r) => {
                const subtitle = subtitleFor(r);
                return (
                    <li key={r.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(r)}
                            data-testid={`search-hit-${r.type}-${r.refId}`}
                            className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-surface-hover cursor-pointer"
                        >
                            <span className="shrink-0 text-ink-muted">{iconFor(r.type)}</span>
                            <span className="min-w-0">
                                <span className="block truncate text-ink">
                                    {r.displayTitle}
                                </span>
                                {subtitle && (
                                    <span className="block truncate text-sm text-ink-muted">
                                        {subtitle}
                                    </span>
                                )}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

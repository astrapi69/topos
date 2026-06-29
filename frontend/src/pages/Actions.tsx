/**
 * Open-actions list, grouped by container.
 *
 * Each row shows item content, action text, container label,
 * and a one-click "mark done" button. The button optimistically
 * removes the action from the open list, then settles via the
 * API call. On failure, the row is restored.
 */

import {useMemo, useState} from "react";

import NavBar from "../components/NavBar";
import {api} from "../api/client";
import {useActions, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import type {ActionRow} from "../types/topos";

export default function Actions() {
    const {t} = useI18n();
    const actions = useActions({status: "open"});
    const items = useItems();
    const containers = useContainers();
    const [hidden, setHidden] = useState<Set<number>>(new Set());
    const [errors, setErrors] = useState<Map<number, string>>(new Map());

    const itemById = useMemo(
        () => new Map(items.data.map((i) => [i.id, i])),
        [items.data],
    );
    const containerById = useMemo(
        () => new Map(containers.data.map((c) => [c.id, c])),
        [containers.data],
    );

    const visible = actions.data.filter((a) => !hidden.has(a.id));

    const grouped = useMemo(() => {
        const map = new Map<number, ActionRow[]>();
        for (const action of visible) {
            const item = itemById.get(action.itemId);
            const cid = item?.containerId ?? -1;
            const bucket = map.get(cid) ?? [];
            bucket.push(action);
            map.set(cid, bucket);
        }
        return Array.from(map.entries()).sort(([a], [b]) => {
            const labelA = containerById.get(a)?.label ?? "";
            const labelB = containerById.get(b)?.label ?? "";
            return labelA.localeCompare(labelB);
        });
    }, [visible, itemById, containerById]);

    async function handleComplete(id: number) {
        // Optimistic: hide immediately, restore on failure.
        setHidden((prev) => new Set(prev).add(id));
        setErrors((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
        try {
            await api.actions.complete(id);
            await actions.refresh();
            setHidden((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            notify.success(t("topos.toast.action_done", "Aktion als erledigt markiert"));
        } catch (e) {
            setHidden((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            notify.error(
                errorMessage(e, t("topos.toast.action_done_failed", "Aktion konnte nicht abgeschlossen werden")),
                e,
            );
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <h1 data-testid="actions-title">
                    {t("topos.page.actions.title", "Offene Aktionen")}
                </h1>

                {visible.length === 0 && !actions.loading && (
                    <p data-testid="actions-empty" style={{color: "#666"}}>
                        {t("topos.page.actions.empty", "Keine offenen Aktionen.")}
                    </p>
                )}

                {grouped.map(([containerId, rows]) => (
                    <section
                        key={containerId}
                        data-testid={`actions-group-${containerId}`}
                        style={{marginBottom: "1.5rem"}}
                    >
                        <h2>
                            {containerById.get(containerId)?.label ??
                                t("topos.page.actions.no_container", "Ohne Container")}
                        </h2>
                        <ul>
                            {rows.map((action) => {
                                const item = itemById.get(action.itemId);
                                const errorMsg = errors.get(action.id);
                                return (
                                    <li
                                        key={action.id}
                                        data-testid={`action-row-${action.id}`}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "0.5rem 0",
                                            borderBottom: "1px solid #eee",
                                            gap: "1rem",
                                        }}
                                    >
                                        <div>
                                            <strong>{action.text}</strong>
                                            <br />
                                            <small style={{color: "#666"}}>
                                                {item?.content ??
                                                    t(
                                                        "topos.page.actions.missing_item",
                                                        "Eintrag nicht geladen",
                                                    )}
                                            </small>
                                            {errorMsg && (
                                                <div
                                                    data-testid={`action-error-${action.id}`}
                                                    style={{color: "#c00", fontSize: "0.875rem"}}
                                                >
                                                    {errorMsg}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            data-testid={`action-complete-${action.id}`}
                                            onClick={() => handleComplete(action.id)}
                                        >
                                            {t("topos.page.actions.mark_done", "Erledigt")}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </main>
        </>
    );
}

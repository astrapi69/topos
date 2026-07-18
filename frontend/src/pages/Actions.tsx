/**
 * Actions page with full CRUD and status filtering.
 *
 * - Status filter (open / done / archived / all) drives the fetch.
 * - Each action can be completed, reopened, edited inline, or deleted
 *   (delete behind a confirmation dialog).
 * - A "new action" form attaches an action to any item (item picker +
 *   text + optional due date).
 * - Item content and container labels link to the container detail.
 * - Every mutation reports via toast.
 */

import {useMemo, useState} from "react";
import {Link} from "react-router-dom";

import NavBar from "../components/NavBar";
import FormField from "../components/FormField";
import {api} from "../api/client";
import {useActions, useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {notify, errorMessage} from "../utils/notify";
import {indexRemove, indexUpsertAction} from "../search/buildIndex";
import {btn, btnPrimary, btnDanger, card, input, muted, link, pill} from "../ui/classes";
import type {ActionRow, ActionStatus} from "../types/topos";

type StatusFilter = ActionStatus | "all";

const FILTERS: StatusFilter[] = ["open", "done", "archived", "all"];

export default function Actions() {
    const {t} = useI18n();
    const {confirm} = useDialog();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
    const actions = useActions(statusFilter === "all" ? {} : {status: statusFilter});
    const items = useItems();
    const containers = useContainers();

    const [creating, setCreating] = useState(false);
    const [newItemId, setNewItemId] = useState<number | null>(null);
    const [newText, setNewText] = useState("");
    const [newDue, setNewDue] = useState("");

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState("");
    const [editDue, setEditDue] = useState("");

    const itemById = useMemo(
        () => new Map(items.data.map((i) => [i.id, i])),
        [items.data],
    );
    const containerById = useMemo(
        () => new Map(containers.data.map((c) => [c.id, c])),
        [containers.data],
    );

    const grouped = useMemo(() => {
        const map = new Map<number, ActionRow[]>();
        for (const action of actions.data) {
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
    }, [actions.data, itemById, containerById]);

    async function handleComplete(id: number) {
        try {
            const updated = await api.actions.complete(id);
            indexUpsertAction(updated);
            await actions.refresh();
            notify.success(t("topos.toast.action_done", "Aktion als erledigt markiert"));
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.action_done_failed", "Aktion konnte nicht abgeschlossen werden")), e);
        }
    }

    async function handleReopen(id: number) {
        try {
            const updated = await api.actions.reopen(id);
            indexUpsertAction(updated);
            await actions.refresh();
            notify.success(t("topos.toast.action_reopened", "Aktion wieder geöffnet"));
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.action_reopen_failed", "Aktion konnte nicht wieder geöffnet werden")), e);
        }
    }

    function resetCreate() {
        setCreating(false);
        setNewItemId(null);
        setNewText("");
        setNewDue("");
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (newItemId === null) {
            notify.warning(t("topos.page.actions.item_required", "Eintrag ist erforderlich."));
            return;
        }
        if (!newText.trim()) {
            notify.warning(t("topos.page.actions.text_required", "Text ist erforderlich."));
            return;
        }
        try {
            const created = await api.actions.create({
                itemId: newItemId,
                text: newText.trim(),
                dueDate: newDue.trim() || null,
            });
            indexUpsertAction(created);
            await actions.refresh();
            notify.success(t("topos.toast.action_created", "Aktion erstellt"));
            resetCreate();
        } catch (err) {
            notify.error(errorMessage(err, t("topos.toast.action_create_failed", "Aktion konnte nicht erstellt werden")), err);
        }
    }

    function startEdit(action: ActionRow) {
        setEditingId(action.id);
        setEditText(action.text);
        setEditDue(action.dueDate ?? "");
    }

    async function handleSaveEdit(id: number) {
        if (!editText.trim()) {
            notify.warning(t("topos.page.actions.text_required", "Text ist erforderlich."));
            return;
        }
        try {
            const updated = await api.actions.update(id, {
                text: editText.trim(),
                dueDate: editDue.trim() || null,
            });
            indexUpsertAction(updated);
            await actions.refresh();
            notify.success(t("topos.toast.action_updated", "Aktion aktualisiert"));
            setEditingId(null);
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.action_update_failed", "Aktion konnte nicht aktualisiert werden")), e);
        }
    }

    async function handleDelete(action: ActionRow) {
        const ok = await confirm(
            t("topos.confirm.delete_action_title", "Aktion löschen?"),
            t("topos.confirm.delete_action_message", "Die Aktion \"{text}\" wird dauerhaft gelöscht.").replace(
                "{text}",
                action.text,
            ),
            "danger",
            {
                confirmLabel: t("topos.common.delete", "Löschen"),
                cancelLabel: t("topos.common.cancel", "Abbrechen"),
            },
        );
        if (!ok) return;
        try {
            await api.actions.delete(action.id);
            indexRemove("action", action.id);
            await actions.refresh();
            notify.success(t("topos.toast.action_deleted", "Aktion gelöscht"));
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.action_delete_failed", "Aktion konnte nicht gelöscht werden")), e);
        }
    }

    return (
        <>
            <NavBar />
            <main className="p-4 sm:p-6">
                <header style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem"}}>
                    <h1 data-testid="actions-title">{t("topos.page.actions.title", "Aktionen")}</h1>
                    <button
                        type="button"
                        className={btnPrimary}
                        data-testid="actions-new-button"
                        onClick={() => setCreating((v) => !v)}
                    >
                        {t("topos.page.actions.new_action", "Neue Aktion")}
                    </button>
                </header>

                <nav
                    data-testid="actions-filter"
                    style={{display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap"}}
                >
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            className={statusFilter === f ? btnPrimary : btn}
                            data-testid={`actions-filter-${f}`}
                            onClick={() => setStatusFilter(f)}
                            aria-pressed={statusFilter === f}
                        >
                            {t(`topos.page.actions.filter_${f}`, f)}
                        </button>
                    ))}
                </nav>

                {creating && (
                    <form
                        data-testid="actions-create-form"
                        onSubmit={handleCreate}
                        className={`${card} p-4 mb-6 flex flex-col gap-2 max-w-xl`}
                    >
                        <h2 style={{margin: 0, fontSize: "1rem"}}>
                            {t("topos.page.actions.create_title", "Neue Aktion")}
                        </h2>
                        <FormField label={t("topos.page.actions.item", "Eintrag")}>
                            <select
                                className={input}
                                data-testid="action-create-item"
                                value={newItemId ?? ""}
                                onChange={(e) => setNewItemId(e.target.value === "" ? null : Number(e.target.value))}
                            >
                                <option value="">--</option>
                                {items.data.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.content}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label={t("topos.page.actions.text", "Text")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="action-create-text"
                                value={newText}
                                onChange={(e) => setNewText(e.target.value)}
                            />
                        </FormField>
                        <FormField label={t("topos.page.actions.due_date", "Fälligkeitsdatum")}>
                            <input
                                type="date"
                                className={input}
                                data-testid="action-create-due"
                                value={newDue}
                                onChange={(e) => setNewDue(e.target.value)}
                            />
                        </FormField>
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button type="submit" className={btnPrimary} data-testid="action-create-submit">
                                {t("topos.common.save", "Speichern")}
                            </button>
                            <button type="button" className={btn} data-testid="action-create-cancel" onClick={resetCreate}>
                                {t("topos.common.cancel", "Abbrechen")}
                            </button>
                        </div>
                    </form>
                )}

                {actions.data.length === 0 && !actions.loading && (
                    <p data-testid="actions-empty" className={muted}>
                        {t("topos.page.actions.empty", "Keine Aktionen.")}
                    </p>
                )}

                {grouped.map(([containerId, rows]) => {
                    const container = containerById.get(containerId);
                    return (
                        <section
                            key={containerId}
                            data-testid={`actions-group-${containerId}`}
                            style={{marginBottom: "1.5rem"}}
                        >
                            <h2 style={{fontSize: "1.05rem"}}>
                                {container ? (
                                    <Link
                                        to={`/containers/${container.id}`}
                                        className={link}
                                        data-testid={`actions-group-link-${container.id}`}
                                    >
                                        {container.label}
                                    </Link>
                                ) : (
                                    t("topos.page.actions.no_container", "Ohne Container")
                                )}
                            </h2>
                            <ul style={{listStyle: "none", padding: 0}}>
                                {rows.map((action) => {
                                    const item = itemById.get(action.itemId);
                                    const isEditing = editingId === action.id;
                                    return (
                                        <li
                                            key={action.id}
                                            data-testid={`action-row-${action.id}`}
                                            style={{
                                                padding: "0.5rem 0",
                                                borderBottom: "1px solid var(--border)",
                                            }}
                                        >
                                            {isEditing ? (
                                                <div
                                                    data-testid={`action-edit-form-${action.id}`}
                                                    style={{display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap"}}
                                                >
                                                    <input
                                                        type="text"
                                                        className={input}
                                                        data-testid={`action-edit-text-${action.id}`}
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        style={{flex: 1, minWidth: 200}}
                                                    />
                                                    <input
                                                        type="date"
                                                        className={input}
                                                        data-testid={`action-edit-due-${action.id}`}
                                                        value={editDue}
                                                        onChange={(e) => setEditDue(e.target.value)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={btnPrimary}
                                                        data-testid={`action-edit-save-${action.id}`}
                                                        onClick={() => handleSaveEdit(action.id)}
                                                    >
                                                        {t("topos.common.save", "Speichern")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={btn}
                                                        data-testid={`action-edit-cancel-${action.id}`}
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        {t("topos.common.cancel", "Abbrechen")}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        gap: "1rem",
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    <div>
                                                        <strong>{action.text}</strong>
                                                        {action.dueDate && (
                                                            <span
                                                                className={muted}
                                                                data-testid={`action-due-${action.id}`}
                                                                style={{marginLeft: "0.5rem", fontSize: "0.875rem"}}
                                                            >
                                                                {t("topos.action.due", "fällig")}: {action.dueDate}
                                                            </span>
                                                        )}
                                                        <span
                                                            className={`${pill} ml-2`}
                                                            data-testid={`action-status-${action.id}`}
                                                        >
                                                            {t(`topos.action.status.${action.status}`, action.status)}
                                                        </span>
                                                        <br />
                                                        {item ? (
                                                            <Link
                                                                to={`/containers/${item.containerId}`}
                                                                className={link}
                                                                data-testid={`action-item-link-${action.id}`}
                                                                style={{fontSize: "0.875rem"}}
                                                            >
                                                                {item.content}
                                                            </Link>
                                                        ) : (
                                                            <small className={muted}>
                                                                {t("topos.page.actions.missing_item", "Eintrag nicht geladen")}
                                                            </small>
                                                        )}
                                                    </div>
                                                    <div style={{display: "flex", gap: "0.5rem", flexWrap: "wrap"}}>
                                                        {action.status === "open" ? (
                                                            <button
                                                                type="button"
                                                                className={btn}
                                                                data-testid={`action-complete-${action.id}`}
                                                                onClick={() => handleComplete(action.id)}
                                                            >
                                                                {t("topos.page.actions.mark_done", "Erledigt")}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className={btn}
                                                                data-testid={`action-reopen-${action.id}`}
                                                                onClick={() => handleReopen(action.id)}
                                                            >
                                                                {t("topos.page.actions.reopen", "Wieder öffnen")}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className={btn}
                                                            data-testid={`action-edit-${action.id}`}
                                                            onClick={() => startEdit(action)}
                                                        >
                                                            {t("topos.common.edit", "Bearbeiten")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={btnDanger}
                                                            data-testid={`action-delete-${action.id}`}
                                                            onClick={() => handleDelete(action)}
                                                        >
                                                            {t("topos.common.delete", "Löschen")}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </main>
        </>
    );
}

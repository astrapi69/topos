/**
 * Container detail: metadata (editable), child item list with per-item
 * action badges, and container delete. A "new item" launcher and inline
 * item delete round out item management.
 */

import {useEffect, useMemo, useState} from "react";
import {useParams, Link, useNavigate, useLocation} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useActions, useContainer, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {api} from "../api/client";
import {notify, errorMessage} from "../utils/notify";
import {indexRemove, indexUpsertContainer} from "../search/buildIndex";
import {btn, btnPrimary, btnDanger, input, muted, danger, link} from "../ui/classes";
import type {ActionRow, ContainerType, Owner} from "../types/topos";

// Mobile-only inline field label inside each stacked item card; hidden
// from md up where the column header carries the label instead.
const cellLabel = "md:hidden font-medium text-gray-500 dark:text-gray-400";

interface EditState {
    type: ContainerType;
    owner: Owner;
    label: string;
    description: string;
    location: string;
    sizeGroup: string;
}

export default function ContainerDetail() {
    const {t} = useI18n();
    const params = useParams<{id: string}>();
    const navigate = useNavigate();
    const containerId = params.id ? Number(params.id) : null;
    const {data: container, loading, error, refresh} = useContainer(containerId);
    const items = useItems({containerId: containerId ?? undefined});
    const actions = useActions({});
    const {confirm} = useDialog();

    const [editing, setEditing] = useState(false);
    const [edit, setEdit] = useState<EditState | null>(null);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const {hash} = useLocation();

    // Scroll-to-item when arriving from search via a "#item-<id>" hash.
    useEffect(() => {
        if (!hash.startsWith("#item-")) return;
        if (items.data.length === 0) return;
        const el = document.getElementById(hash.slice(1));
        if (el) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
            el.classList.add("ring-2", "ring-blue-500");
            const timer = setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 1600);
            return () => clearTimeout(timer);
        }
    }, [hash, items.data]);

    const actionsByItem = useMemo(() => {
        const map = new Map<number, ActionRow[]>();
        for (const action of actions.data) {
            const bucket = map.get(action.itemId) ?? [];
            bucket.push(action);
            map.set(action.itemId, bucket);
        }
        return map;
    }, [actions.data]);

    if (containerId === null) {
        return (
            <>
                <NavBar />
                <main style={{padding: "1.5rem"}}>
                    <p>{t("topos.page.container_detail.no_id", "Kein Container ausgewählt.")}</p>
                </main>
            </>
        );
    }

    function toggleExpanded(itemId: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }

    function openEdit() {
        if (!container) return;
        setEdit({
            type: container.type,
            owner: container.owner,
            label: container.label,
            description: container.description ?? "",
            location: container.location ?? "",
            sizeGroup: container.sizeGroup ?? "",
        });
        setEditing(true);
    }

    async function handleSaveContainer(e: React.FormEvent) {
        e.preventDefault();
        if (!edit || containerId === null) return;
        if (!edit.label.trim()) {
            notify.warning(t("topos.page.containers.label_required", "Bezeichnung ist erforderlich."));
            return;
        }
        setSaving(true);
        try {
            const updated = await api.containers.update(containerId, {
                type: edit.type,
                owner: edit.owner,
                label: edit.label.trim(),
                description: edit.description.trim() || null,
                location: edit.location.trim() || null,
                sizeGroup: edit.sizeGroup.trim() || null,
            });
            indexUpsertContainer(updated);
            await refresh();
            notify.success(t("topos.toast.container_updated", "Container aktualisiert"));
            setEditing(false);
        } catch (err) {
            notify.error(errorMessage(err, t("topos.toast.container_save_failed", "Container konnte nicht gespeichert werden")), err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteContainer() {
        if (!container || containerId === null) return;
        const itemCount = items.data.length;
        let message = t("topos.confirm.delete_container_message", "Der Container \"{label}\" wird dauerhaft gelöscht.").replace(
            "{label}",
            container.label,
        );
        if (itemCount > 0) {
            message +=
                " " +
                t(
                    "topos.confirm.delete_container_items_warning",
                    "Achtung: {count} zugehörige Einträge werden ebenfalls gelöscht.",
                ).replace("{count}", String(itemCount));
        }
        const ok = await confirm(
            t("topos.confirm.delete_container_title", "Container löschen?"),
            message,
            "danger",
            {
                confirmLabel: t("topos.common.delete", "Löschen"),
                cancelLabel: t("topos.common.cancel", "Abbrechen"),
            },
        );
        if (!ok) return;
        try {
            await api.containers.delete(containerId);
            indexRemove("container", containerId);
            for (const it of items.data) indexRemove("item", it.id);
            notify.success(t("topos.toast.container_deleted", "Container gelöscht"));
            navigate("/containers");
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.container_delete_failed", "Container konnte nicht gelöscht werden")), e);
        }
    }

    async function handleDeleteItem(itemId: number, itemContent: string) {
        const ok = await confirm(
            t("topos.confirm.delete_item_title", "Eintrag löschen?"),
            t(
                "topos.confirm.delete_item_message",
                "Der Eintrag \"{content}\" wird dauerhaft gelöscht.",
            ).replace("{content}", itemContent),
            "danger",
            {
                confirmLabel: t("topos.common.delete", "Löschen"),
                cancelLabel: t("topos.common.cancel", "Abbrechen"),
            },
        );
        if (!ok) return;
        try {
            await api.items.delete(itemId);
            indexRemove("item", itemId);
            await items.refresh();
            notify.success(t("topos.toast.item_deleted", "Eintrag gelöscht"));
        } catch (e) {
            notify.error(
                errorMessage(e, t("topos.toast.item_delete_failed", "Eintrag konnte nicht gelöscht werden")),
                e,
            );
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <Link to="/containers" className={link} data-testid="container-detail-back">
                    {t("topos.common.back", "Zurück")}
                </Link>
                <header style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem"}}>
                    <h1 data-testid="container-detail-title">
                        {container?.label ??
                            (loading
                                ? t("topos.common.loading", "Lade...")
                                : t("topos.page.container_detail.missing", "Container nicht gefunden"))}
                    </h1>
                    {container && !editing && (
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button type="button" className={btn} data-testid="container-detail-edit" onClick={openEdit}>
                                {t("topos.common.edit", "Bearbeiten")}
                            </button>
                            <button
                                type="button"
                                className={btnDanger}
                                data-testid="container-detail-delete"
                                onClick={handleDeleteContainer}
                            >
                                {t("topos.common.delete", "Löschen")}
                            </button>
                        </div>
                    )}
                </header>
                {error && (
                    <p data-testid="container-detail-error" className={danger}>
                        {error.message}
                    </p>
                )}

                {container && editing && edit && (
                    <form
                        data-testid="container-edit-form"
                        onSubmit={handleSaveContainer}
                        style={{
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "1rem",
                            margin: "1rem 0",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            maxWidth: 640,
                        }}
                    >
                        <EditField label={t("topos.container.type_label", "Typ")}>
                            <select
                                className={input}
                                data-testid="container-edit-type"
                                value={edit.type}
                                onChange={(e) => setEdit({...edit, type: e.target.value as ContainerType})}
                            >
                                <option value="folder">{t("topos.container.type.folder", "Ordner")}</option>
                                <option value="box">{t("topos.container.type.box", "Box")}</option>
                            </select>
                        </EditField>
                        <EditField label={t("topos.container.owner", "Eigentümer")}>
                            <select
                                className={input}
                                data-testid="container-edit-owner"
                                value={edit.owner}
                                onChange={(e) => setEdit({...edit, owner: e.target.value as Owner})}
                            >
                                <option value="self">{t("topos.owner.self", "Ich")}</option>
                                <option value="parents">{t("topos.owner.parents", "Eltern")}</option>
                                <option value="shared">{t("topos.owner.shared", "Geteilt")}</option>
                            </select>
                        </EditField>
                        <EditField label={t("topos.container.label", "Bezeichnung")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-edit-label"
                                value={edit.label}
                                onChange={(e) => setEdit({...edit, label: e.target.value})}
                                required
                            />
                        </EditField>
                        <EditField label={t("topos.container.description", "Beschreibung")}>
                            <textarea
                                className={input}
                                data-testid="container-edit-description"
                                value={edit.description}
                                onChange={(e) => setEdit({...edit, description: e.target.value})}
                                rows={2}
                            />
                        </EditField>
                        <EditField label={t("topos.container.location", "Ort")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-edit-location"
                                value={edit.location}
                                onChange={(e) => setEdit({...edit, location: e.target.value})}
                            />
                        </EditField>
                        <EditField label={t("topos.container.size_group", "Größengruppe")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-edit-size-group"
                                value={edit.sizeGroup}
                                onChange={(e) => setEdit({...edit, sizeGroup: e.target.value})}
                            />
                        </EditField>
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button type="submit" className={btnPrimary} data-testid="container-edit-save" disabled={saving}>
                                {saving ? t("topos.common.saving", "Speichere...") : t("topos.common.save", "Speichern")}
                            </button>
                            <button type="button" className={btn} data-testid="container-edit-cancel" onClick={() => setEditing(false)}>
                                {t("topos.common.cancel", "Abbrechen")}
                            </button>
                        </div>
                    </form>
                )}

                {container && !editing && (
                    <dl
                        data-testid="container-meta"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "max-content auto",
                            gap: "0.25rem 0.75rem",
                            marginBottom: "1.5rem",
                        }}
                    >
                        <dt>{t("topos.container.external_id", "Nr.")}</dt>
                        <dd>{container.externalId}</dd>
                        <dt>{t("topos.container.type_label", "Typ")}</dt>
                        <dd>{t(`topos.container.type.${container.type}`, container.type)}</dd>
                        <dt>{t("topos.container.owner", "Eigentümer")}</dt>
                        <dd>{t(`topos.owner.${container.owner}`, container.owner)}</dd>
                        <dt>{t("topos.container.location", "Ort")}</dt>
                        <dd>{container.location ?? ""}</dd>
                        {container.sizeGroup && (
                            <>
                                <dt>{t("topos.container.size_group", "Größengruppe")}</dt>
                                <dd>{container.sizeGroup}</dd>
                            </>
                        )}
                        {container.description && (
                            <>
                                <dt>{t("topos.container.description", "Beschreibung")}</dt>
                                <dd style={{whiteSpace: "pre-line"}}>{container.description}</dd>
                            </>
                        )}
                    </dl>
                )}

                <section>
                    <header
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h2>{t("topos.page.container_detail.items", "Einträge")}</h2>
                        <button
                            type="button"
                            className={btnPrimary}
                            data-testid="container-detail-new-item"
                            onClick={() =>
                                navigate(`/items/new?container_id=${containerId}`)
                            }
                        >
                            {t("topos.page.container_detail.new_item", "Neuer Eintrag")}
                        </button>
                    </header>

                    {/*
                     * Responsive: a stacked card per item on mobile, a
                     * 4-column grid row from md up. The row keeps its
                     * `item-${id}` anchor id for deep links from search.
                     */}
                    <div data-testid="container-detail-items" className="mt-2">
                        <div className="hidden md:grid md:grid-cols-[1fr_7rem_1fr_auto] gap-2 px-2 py-2 border-b border-gray-300 dark:border-gray-700 text-left font-medium text-gray-600 dark:text-gray-300">
                            <span>{t("topos.item.content", "Inhalt")}</span>
                            <span>{t("topos.item.priority", "Priorität")}</span>
                            <span>{t("topos.item.category", "Kategorie")}</span>
                            <span>{t("topos.common.actions", "Aktionen")}</span>
                        </div>
                        {items.data.map((item) => {
                            const itemActions = actionsByItem.get(item.id) ?? [];
                            const isOpen = expanded.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    id={`item-${item.id}`}
                                    data-testid={`item-row-${item.id}`}
                                    className="grid grid-cols-1 md:grid-cols-[1fr_7rem_1fr_auto] gap-1 md:gap-2 md:items-start border md:border-0 md:border-b border-gray-200 dark:border-gray-700 rounded md:rounded-none p-3 md:px-2 md:py-2 mb-2 md:mb-0"
                                >
                                    <div>
                                        <div>{item.content}</div>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 cursor-pointer"
                                            data-testid={`item-actions-badge-${item.id}`}
                                            onClick={() => toggleExpanded(item.id)}
                                        >
                                            {t("topos.page.container_detail.item_actions", "Aktionen")}: {itemActions.length}{" "}
                                            {itemActions.length > 0 ? (isOpen ? "▾" : "▸") : ""}
                                        </button>
                                        {isOpen && itemActions.length > 0 && (
                                            <ul
                                                data-testid={`item-actions-list-${item.id}`}
                                                style={{margin: "0.25rem 0 0", paddingLeft: "1.25rem", fontSize: "0.8125rem"}}
                                            >
                                                {itemActions.map((a) => (
                                                    <li key={a.id}>
                                                        {a.text}{" "}
                                                        <span className={muted}>
                                                            [{t(`topos.action.status.${a.status}`, a.status)}]
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div>
                                        <span className={cellLabel}>{t("topos.item.priority", "Priorität")}: </span>
                                        {t(`topos.priority.${item.priority}`, item.priority)}
                                    </div>
                                    <div>
                                        <span className={cellLabel}>{t("topos.item.category", "Kategorie")}: </span>
                                        {item.categoryPath ?? ""}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                        <Link
                                            to={`/items/${item.id}`}
                                            className={btn}
                                            data-testid={`edit-item-${item.id}`}
                                        >
                                            {t("topos.common.edit", "Bearbeiten")}
                                        </Link>
                                        <button
                                            type="button"
                                            className={btnDanger}
                                            data-testid={`delete-item-${item.id}`}
                                            onClick={() => handleDeleteItem(item.id, item.content)}
                                        >
                                            {t("topos.common.delete", "Löschen")}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {items.data.length === 0 && !items.loading && (
                            <div data-testid="container-detail-empty" className={`${muted} p-4`}>
                                {t(
                                    "topos.page.container_detail.empty",
                                    "Keine Einträge in diesem Container.",
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}

function EditField({label, children}: {label: string; children: React.ReactNode}) {
    return (
        <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem", gap: 2}}>
            {label}
            {children}
        </label>
    );
}

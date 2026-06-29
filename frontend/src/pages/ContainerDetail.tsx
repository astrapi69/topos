/**
 * Container detail: metadata (editable), child item list with per-item
 * action badges, and container delete. A "new item" launcher and inline
 * item delete round out item management.
 */

import {useMemo, useState} from "react";
import {useParams, Link, useNavigate} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useActions, useContainer, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {api} from "../api/client";
import {notify, errorMessage} from "../utils/notify";
import type {ActionRow, ContainerType, Owner} from "../types/topos";

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
            await api.containers.update(containerId, {
                type: edit.type,
                owner: edit.owner,
                label: edit.label.trim(),
                description: edit.description.trim() || null,
                location: edit.location.trim() || null,
                sizeGroup: edit.sizeGroup.trim() || null,
            });
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
                <Link to="/containers" data-testid="container-detail-back">
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
                            <button type="button" data-testid="container-detail-edit" onClick={openEdit}>
                                {t("topos.common.edit", "Bearbeiten")}
                            </button>
                            <button
                                type="button"
                                data-testid="container-detail-delete"
                                onClick={handleDeleteContainer}
                                style={{color: "var(--danger)"}}
                            >
                                {t("topos.common.delete", "Löschen")}
                            </button>
                        </div>
                    )}
                </header>
                {error && (
                    <p data-testid="container-detail-error" style={{color: "var(--danger)"}}>
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
                                data-testid="container-edit-label"
                                value={edit.label}
                                onChange={(e) => setEdit({...edit, label: e.target.value})}
                                required
                            />
                        </EditField>
                        <EditField label={t("topos.container.description", "Beschreibung")}>
                            <textarea
                                data-testid="container-edit-description"
                                value={edit.description}
                                onChange={(e) => setEdit({...edit, description: e.target.value})}
                                rows={2}
                            />
                        </EditField>
                        <EditField label={t("topos.container.location", "Ort")}>
                            <input
                                type="text"
                                data-testid="container-edit-location"
                                value={edit.location}
                                onChange={(e) => setEdit({...edit, location: e.target.value})}
                            />
                        </EditField>
                        <EditField label={t("topos.container.size_group", "Größengruppe")}>
                            <input
                                type="text"
                                data-testid="container-edit-size-group"
                                value={edit.sizeGroup}
                                onChange={(e) => setEdit({...edit, sizeGroup: e.target.value})}
                            />
                        </EditField>
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button type="submit" data-testid="container-edit-save" disabled={saving}>
                                {saving ? t("topos.common.saving", "Speichere...") : t("topos.common.save", "Speichern")}
                            </button>
                            <button type="button" data-testid="container-edit-cancel" onClick={() => setEditing(false)}>
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
                            data-testid="container-detail-new-item"
                            onClick={() =>
                                navigate(`/items/new?container_id=${containerId}`)
                            }
                        >
                            {t("topos.page.container_detail.new_item", "Neuer Eintrag")}
                        </button>
                    </header>

                    <table
                        data-testid="container-detail-items"
                        style={{width: "100%", borderCollapse: "collapse", marginTop: "0.5rem"}}
                    >
                        <thead>
                            <tr style={{textAlign: "left", borderBottom: "1px solid var(--border)"}}>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.content", "Inhalt")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.priority", "Priorität")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.item.category", "Kategorie")}</th>
                                <th style={{padding: "0.5rem"}}>{t("topos.common.actions", "Aktionen")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.data.map((item) => {
                                const itemActions = actionsByItem.get(item.id) ?? [];
                                const isOpen = expanded.has(item.id);
                                return (
                                    <tr
                                        key={item.id}
                                        data-testid={`item-row-${item.id}`}
                                        style={{borderBottom: "1px solid var(--border)"}}
                                    >
                                        <td style={{padding: "0.5rem"}}>
                                            <div>{item.content}</div>
                                            <button
                                                type="button"
                                                data-testid={`item-actions-badge-${item.id}`}
                                                onClick={() => toggleExpanded(item.id)}
                                                style={{
                                                    background: "none",
                                                    border: "1px solid var(--border)",
                                                    borderRadius: 10,
                                                    cursor: "pointer",
                                                    fontSize: "0.75rem",
                                                    padding: "1px 8px",
                                                    marginTop: 4,
                                                    color: "var(--text-secondary)",
                                                }}
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
                                                            <span style={{color: "var(--text-secondary)"}}>
                                                                [{t(`topos.action.status.${a.status}`, a.status)}]
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                        <td style={{padding: "0.5rem"}}>
                                            {t(`topos.priority.${item.priority}`, item.priority)}
                                        </td>
                                        <td style={{padding: "0.5rem"}}>{item.categoryPath ?? ""}</td>
                                        <td style={{padding: "0.5rem"}}>
                                            <Link
                                                to={`/items/${item.id}`}
                                                data-testid={`edit-item-${item.id}`}
                                            >
                                                {t("topos.common.edit", "Bearbeiten")}
                                            </Link>
                                            {" / "}
                                            <button
                                                type="button"
                                                data-testid={`delete-item-${item.id}`}
                                                onClick={() => handleDeleteItem(item.id, item.content)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "var(--danger)",
                                                    cursor: "pointer",
                                                    padding: 0,
                                                }}
                                            >
                                                {t("topos.common.delete", "Löschen")}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {items.data.length === 0 && !items.loading && (
                                <tr>
                                    <td colSpan={4} style={{padding: "1rem", color: "var(--text-secondary)"}}>
                                        {t(
                                            "topos.page.container_detail.empty",
                                            "Keine Einträge in diesem Container.",
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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

/**
 * Create / edit an Item. The same page handles both via the route:
 *
 * - ``/items/:id`` -> edit existing item
 * - ``/items/new?container_id=X`` -> create new item bound to a container
 *
 * The container picker is a plain select populated from the cached
 * containers list. Category picker is an input with datalist so the
 * user can pick a known path or type a fresh one.
 */

import {useEffect, useState} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";

import NavBar from "../components/NavBar";
import {api} from "../api/client";
import {useCategories, useContainers} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {indexUpsertItem} from "../search/buildIndex";
import {btn, btnPrimary, input} from "../ui/classes";
import type {Item, Priority} from "../types/topos";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "very_high"];

export default function ItemEditor() {
    const {t} = useI18n();
    const params = useParams<{id: string}>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const containers = useContainers();
    const categories = useCategories();

    const isNew = !params.id || params.id === "new";
    const itemId = isNew ? null : Number(params.id);
    const initialContainerId = isNew
        ? Number(searchParams.get("container_id") ?? "0") || null
        : null;

    const [containerId, setContainerId] = useState<number | null>(initialContainerId);
    const [content, setContent] = useState("");
    const [priority, setPriority] = useState<Priority>("none");
    const [categoryPath, setCategoryPath] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isNew) return;
        if (itemId === null || Number.isNaN(itemId)) return;
        setLoading(true);
        api.items
            .get(itemId)
            .then((row: Item) => {
                setContainerId(row.containerId);
                setContent(row.content);
                setPriority(row.priority);
                setCategoryPath(row.categoryPath ?? "");
                setNotes(row.notes ?? "");
            })
            .catch((e) =>
                notify.error(
                    errorMessage(e, t("topos.toast.item_load_failed", "Eintrag konnte nicht geladen werden")),
                    e,
                ),
            )
            .finally(() => setLoading(false));
    }, [isNew, itemId, t]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (containerId === null) {
            notify.warning(t("topos.page.item_editor.container_required", "Container ist erforderlich."));
            return;
        }
        if (!content.trim()) {
            notify.warning(t("topos.page.item_editor.content_required", "Inhalt ist erforderlich."));
            return;
        }
        setSaving(true);
        try {
            if (isNew) {
                const created = await api.items.create({
                    containerId,
                    content: content.trim(),
                    priority,
                    categoryPath: categoryPath.trim() || null,
                    notes: notes.trim() || null,
                });
                indexUpsertItem(created);
                notify.success(t("topos.toast.item_created", "Eintrag erstellt"));
                navigate(`/containers/${created.containerId}`);
            } else if (itemId !== null) {
                const updated = await api.items.update(itemId, {
                    containerId,
                    content: content.trim(),
                    priority,
                    categoryPath: categoryPath.trim() || null,
                    notes: notes.trim() || null,
                });
                indexUpsertItem(updated);
                notify.success(t("topos.toast.item_updated", "Eintrag aktualisiert"));
                navigate(`/containers/${containerId}`);
            }
        } catch (err) {
            notify.error(
                errorMessage(err, t("topos.toast.item_save_failed", "Eintrag konnte nicht gespeichert werden")),
                err,
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: 720}}>
                <h1 data-testid="item-editor-title">
                    {isNew
                        ? t("topos.page.item_editor.new_title", "Neuer Eintrag")
                        : t("topos.page.item_editor.edit_title", "Eintrag bearbeiten")}
                </h1>

                {loading && <p data-testid="item-editor-loading">{t("topos.common.loading", "Lade...")}</p>}

                <form onSubmit={handleSubmit} data-testid="item-editor-form">
                    <Field
                        label={t("topos.item.container", "Container")}
                        testId="item-editor-container"
                    >
                        <select
                            className={input}
                            value={containerId ?? ""}
                            onChange={(e) =>
                                setContainerId(e.target.value === "" ? null : Number(e.target.value))
                            }
                            data-testid="item-editor-container-select"
                        >
                            <option value="">--</option>
                            {containers.data.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.externalId} - {c.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label={t("topos.item.content", "Inhalt")}
                        testId="item-editor-content"
                    >
                        <input
                            type="text"
                            className={input}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            data-testid="item-editor-content-input"
                            required
                        />
                    </Field>

                    <Field
                        label={t("topos.item.priority", "Priorität")}
                        testId="item-editor-priority"
                    >
                        <select
                            className={input}
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as Priority)}
                            data-testid="item-editor-priority-select"
                        >
                            {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                    {t(`topos.priority.${p}`, p)}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label={t("topos.item.category", "Kategorie")}
                        testId="item-editor-category"
                    >
                        <input
                            type="text"
                            className={input}
                            value={categoryPath}
                            onChange={(e) => setCategoryPath(e.target.value)}
                            list="category-paths"
                            data-testid="item-editor-category-input"
                            placeholder="finance/bank"
                        />
                        <datalist id="category-paths">
                            {categories.data.map((c) => (
                                <option key={c.id} value={c.path} />
                            ))}
                        </datalist>
                    </Field>

                    <Field
                        label={t("topos.item.notes", "Notizen")}
                        testId="item-editor-notes"
                    >
                        <textarea
                            className={input}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            data-testid="item-editor-notes-input"
                            rows={3}
                        />
                    </Field>

                    <div style={{display: "flex", gap: "0.5rem"}}>
                        <button
                            type="submit"
                            className={btnPrimary}
                            data-testid="item-editor-submit"
                            disabled={saving || loading}
                        >
                            {saving
                                ? t("topos.common.saving", "Speichere...")
                                : t("topos.common.save", "Speichern")}
                        </button>
                        <button
                            type="button"
                            className={btn}
                            onClick={() => navigate(-1)}
                            data-testid="item-editor-cancel"
                        >
                            {t("topos.common.cancel", "Abbrechen")}
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}

function Field({
    label,
    testId,
    children,
}: {
    label: string;
    testId: string;
    children: React.ReactNode;
}) {
    return (
        <label
            data-testid={testId}
            style={{display: "flex", flexDirection: "column", marginBottom: "0.75rem", gap: 4}}
        >
            <span>{label}</span>
            {children}
        </label>
    );
}

/**
 * Container list with inline CRUD.
 *
 * Filters: owner (self/parents/shared), type (folder/box), substring on
 * label/location. Each row links to ContainerDetail and carries
 * edit/delete actions. A create/edit form (shared) handles both new
 * containers and updates; delete is gated by a confirmation dialog that
 * warns when the container still holds items (they cascade-delete).
 */

import {useMemo, useState} from "react";
import {Link} from "react-router-dom";

import NavBar from "../components/NavBar";
import {useContainers, useItems} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {api} from "../api/client";
import {notify, errorMessage} from "../utils/notify";
import {indexRemove, indexUpsertContainer} from "../search/buildIndex";
import {btn, btnPrimary, btnDanger, input, muted, danger, link} from "../ui/classes";
import type {Container, ContainerType, Owner} from "../types/topos";

interface FormState {
    externalId: string;
    type: ContainerType;
    owner: Owner;
    label: string;
    description: string;
    location: string;
    sizeGroup: string;
}

// Mobile-only inline field label shown inside each stacked card; hidden
// from md up where the column header carries the label instead.
const cellLabel = "md:hidden font-medium text-gray-500 dark:text-gray-400";

const EMPTY_FORM: FormState = {
    externalId: "",
    type: "folder",
    owner: "self",
    label: "",
    description: "",
    location: "",
    sizeGroup: "",
};

export default function ContainerList() {
    const {t} = useI18n();
    const {confirm} = useDialog();
    const {data, loading, error, refresh} = useContainers();
    const items = useItems();
    const [owner, setOwner] = useState<Owner | "all">("all");
    const [type, setType] = useState<ContainerType | "all">("all");
    const [needle, setNeedle] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const itemCountByContainer = useMemo(() => {
        const counts = new Map<number, number>();
        for (const item of items.data) {
            counts.set(item.containerId, (counts.get(item.containerId) ?? 0) + 1);
        }
        return counts;
    }, [items.data]);

    const filtered = useMemo(() => {
        return data.filter((c) => {
            if (owner !== "all" && c.owner !== owner) return false;
            if (type !== "all" && c.type !== type) return false;
            if (needle.trim()) {
                const n = needle.trim().toLowerCase();
                if (!c.label.toLowerCase().includes(n) && !(c.location ?? "").toLowerCase().includes(n)) {
                    return false;
                }
            }
            return true;
        });
    }, [data, owner, type, needle]);

    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function openEdit(c: Container) {
        setEditingId(c.id);
        setForm({
            externalId: String(c.externalId),
            type: c.type,
            owner: c.owner,
            label: c.label,
            description: c.description ?? "",
            location: c.location ?? "",
            sizeGroup: c.sizeGroup ?? "",
        });
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.label.trim()) {
            notify.warning(t("topos.page.containers.label_required", "Bezeichnung ist erforderlich."));
            return;
        }
        const description = form.description.trim() || null;
        const location = form.location.trim() || null;
        const sizeGroup = form.sizeGroup.trim() || null;
        setSaving(true);
        try {
            if (editingId === null) {
                const externalId = Number(form.externalId.trim());
                if (!form.externalId.trim() || !Number.isInteger(externalId)) {
                    notify.warning(t("topos.page.containers.external_id_invalid", "Nr. muss eine ganze Zahl sein."));
                    setSaving(false);
                    return;
                }
                const created = await api.containers.create({
                    externalId,
                    type: form.type,
                    owner: form.owner,
                    label: form.label.trim(),
                    description,
                    location,
                    sizeGroup,
                });
                indexUpsertContainer(created);
                notify.success(t("topos.toast.container_created", "Container erstellt"));
            } else {
                const updated = await api.containers.update(editingId, {
                    type: form.type,
                    owner: form.owner,
                    label: form.label.trim(),
                    description,
                    location,
                    sizeGroup,
                });
                indexUpsertContainer(updated);
                notify.success(t("topos.toast.container_updated", "Container aktualisiert"));
            }
            await refresh();
            closeForm();
        } catch (err) {
            notify.error(errorMessage(err, t("topos.toast.container_save_failed", "Container konnte nicht gespeichert werden")), err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(c: Container) {
        const itemCount = itemCountByContainer.get(c.id) ?? 0;
        let message = t("topos.confirm.delete_container_message", "Der Container \"{label}\" wird dauerhaft gelöscht.").replace(
            "{label}",
            c.label,
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
            await api.containers.delete(c.id);
            indexRemove("container", c.id);
            for (const it of items.data.filter((i) => i.containerId === c.id)) {
                indexRemove("item", it.id);
            }
            await Promise.all([refresh(), items.refresh()]);
            notify.success(t("topos.toast.container_deleted", "Container gelöscht"));
        } catch (e) {
            notify.error(errorMessage(e, t("topos.toast.container_delete_failed", "Container konnte nicht gelöscht werden")), e);
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif"}}>
                <header style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem"}}>
                    <h1 data-testid="container-list-title">
                        {t("topos.page.containers.title", "Container")}
                    </h1>
                    <button type="button" className={btnPrimary} data-testid="container-new-button" onClick={openCreate}>
                        {t("topos.page.containers.new_container", "Neuer Container")}
                    </button>
                </header>

                {showForm && (
                    <form
                        data-testid="container-form"
                        onSubmit={handleSubmit}
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
                        <h2 style={{margin: 0, fontSize: "1rem"}} data-testid="container-form-title">
                            {editingId === null
                                ? t("topos.page.containers.create_title", "Neuer Container")
                                : t("topos.page.containers.edit_title", "Container bearbeiten")}
                        </h2>
                        <FormField label={t("topos.container.external_id", "Nr.")}>
                            <input
                                type="number"
                                className={input}
                                data-testid="container-form-external-id"
                                value={form.externalId}
                                onChange={(e) => setForm((f) => ({...f, externalId: e.target.value}))}
                                disabled={editingId !== null}
                            />
                        </FormField>
                        <FormField label={t("topos.container.type_label", "Typ")}>
                            <select
                                className={input}
                                data-testid="container-form-type"
                                value={form.type}
                                onChange={(e) => setForm((f) => ({...f, type: e.target.value as ContainerType}))}
                            >
                                <option value="folder">{t("topos.container.type.folder", "Ordner")}</option>
                                <option value="box">{t("topos.container.type.box", "Box")}</option>
                            </select>
                        </FormField>
                        <FormField label={t("topos.container.owner", "Eigentümer")}>
                            <select
                                className={input}
                                data-testid="container-form-owner"
                                value={form.owner}
                                onChange={(e) => setForm((f) => ({...f, owner: e.target.value as Owner}))}
                            >
                                <option value="self">{t("topos.owner.self", "Ich")}</option>
                                <option value="parents">{t("topos.owner.parents", "Eltern")}</option>
                                <option value="shared">{t("topos.owner.shared", "Geteilt")}</option>
                            </select>
                        </FormField>
                        <FormField label={t("topos.container.label", "Bezeichnung")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-form-label"
                                value={form.label}
                                onChange={(e) => setForm((f) => ({...f, label: e.target.value}))}
                                required
                            />
                        </FormField>
                        <FormField label={t("topos.container.description", "Beschreibung")}>
                            <textarea
                                className={input}
                                data-testid="container-form-description"
                                value={form.description}
                                onChange={(e) => setForm((f) => ({...f, description: e.target.value}))}
                                rows={2}
                            />
                        </FormField>
                        <FormField label={t("topos.container.location", "Ort")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-form-location"
                                value={form.location}
                                onChange={(e) => setForm((f) => ({...f, location: e.target.value}))}
                            />
                        </FormField>
                        <FormField label={t("topos.container.size_group", "Größengruppe")}>
                            <input
                                type="text"
                                className={input}
                                data-testid="container-form-size-group"
                                value={form.sizeGroup}
                                onChange={(e) => setForm((f) => ({...f, sizeGroup: e.target.value}))}
                            />
                        </FormField>
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button type="submit" className={btnPrimary} data-testid="container-form-submit" disabled={saving}>
                                {saving ? t("topos.common.saving", "Speichere...") : t("topos.common.save", "Speichern")}
                            </button>
                            <button type="button" className={btn} data-testid="container-form-cancel" onClick={closeForm}>
                                {t("topos.common.cancel", "Abbrechen")}
                            </button>
                        </div>
                    </form>
                )}

                <section
                    data-testid="container-filters"
                    style={{display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap"}}
                >
                    <FilterSelect
                        label={t("topos.filter.owner", "Eigentümer")}
                        value={owner}
                        onChange={(v) => setOwner(v as Owner | "all")}
                        options={[
                            ["all", t("topos.filter.all", "Alle")],
                            ["self", t("topos.owner.self", "Ich")],
                            ["parents", t("topos.owner.parents", "Eltern")],
                            ["shared", t("topos.owner.shared", "Geteilt")],
                        ]}
                        testId="filter-owner"
                    />
                    <FilterSelect
                        label={t("topos.filter.type", "Typ")}
                        value={type}
                        onChange={(v) => setType(v as ContainerType | "all")}
                        options={[
                            ["all", t("topos.filter.all", "Alle")],
                            ["folder", t("topos.container.type.folder", "Ordner")],
                            ["box", t("topos.container.type.box", "Box")],
                        ]}
                        testId="filter-type"
                    />
                    <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem"}}>
                        {t("topos.filter.search", "Suche")}
                        <input
                            type="text"
                            className={input}
                            value={needle}
                            onChange={(e) => setNeedle(e.target.value)}
                            data-testid="filter-needle"
                            placeholder={t(
                                "topos.filter.search_placeholder",
                                "Bezeichnung oder Ort",
                            )}
                        />
                    </label>
                </section>

                {loading && data.length === 0 && (
                    <p data-testid="container-list-loading">
                        {t("topos.common.loading", "Lade...")}
                    </p>
                )}
                {error && (
                    <p data-testid="container-list-error" className={danger}>
                        {error.message}
                    </p>
                )}

                {/*
                 * Responsive list: a stacked card per container on mobile
                 * (each field on its own line with a label), a 6-column
                 * grid row from md up. One rendering keeps the test ids
                 * stable across breakpoints.
                 */}
                <div data-testid="container-table" className="mt-2">
                    <div className="hidden md:grid md:grid-cols-[4rem_1fr_6rem_7rem_1fr_auto] gap-2 px-2 py-2 border-b border-gray-300 dark:border-gray-700 text-left font-medium text-gray-600 dark:text-gray-300">
                        <span>{t("topos.container.external_id", "Nr.")}</span>
                        <span>{t("topos.container.label", "Bezeichnung")}</span>
                        <span>{t("topos.container.type_label", "Typ")}</span>
                        <span>{t("topos.container.owner", "Eigentümer")}</span>
                        <span>{t("topos.container.location", "Ort")}</span>
                        <span>{t("topos.common.actions", "Aktionen")}</span>
                    </div>
                    {filtered.map((c) => (
                        <div
                            key={c.id}
                            data-testid={`container-row-${c.id}`}
                            className="grid grid-cols-1 md:grid-cols-[4rem_1fr_6rem_7rem_1fr_auto] gap-1 md:gap-2 md:items-center border md:border-0 md:border-b border-gray-200 dark:border-gray-700 rounded md:rounded-none p-3 md:px-2 md:py-2 mb-2 md:mb-0"
                        >
                            <div>
                                <span className={cellLabel}>{t("topos.container.external_id", "Nr.")}: </span>
                                {c.externalId}
                            </div>
                            <div>
                                <span className={cellLabel}>{t("topos.container.label", "Bezeichnung")}: </span>
                                <Link
                                    to={`/containers/${c.id}`}
                                    className={link}
                                    data-testid={`container-link-${c.id}`}
                                >
                                    {c.label}
                                </Link>
                            </div>
                            <div>
                                <span className={cellLabel}>{t("topos.container.type_label", "Typ")}: </span>
                                {t(`topos.container.type.${c.type}`, c.type)}
                            </div>
                            <div>
                                <span className={cellLabel}>{t("topos.container.owner", "Eigentümer")}: </span>
                                {t(`topos.owner.${c.owner}`, c.owner)}
                            </div>
                            <div>
                                <span className={cellLabel}>{t("topos.container.location", "Ort")}: </span>
                                {c.location ?? ""}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                <button
                                    type="button"
                                    className={btn}
                                    data-testid={`container-edit-${c.id}`}
                                    onClick={() => openEdit(c)}
                                >
                                    {t("topos.common.edit", "Bearbeiten")}
                                </button>
                                <button
                                    type="button"
                                    className={btnDanger}
                                    data-testid={`container-delete-${c.id}`}
                                    onClick={() => handleDelete(c)}
                                >
                                    {t("topos.common.delete", "Löschen")}
                                </button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && !loading && (
                        <div data-testid="container-empty" className={`${muted} p-4`}>
                            {t("topos.page.containers.empty", "Keine Container gefunden.")}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
    testId,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: [string, string][];
    testId: string;
}) {
    return (
        <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem"}}>
            {label}
            <select
                className={input}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                data-testid={testId}
            >
                {options.map(([v, l]) => (
                    <option key={v} value={v}>
                        {l}
                    </option>
                ))}
            </select>
        </label>
    );
}

function FormField({label, children}: {label: string; children: React.ReactNode}) {
    return (
        <label style={{display: "flex", flexDirection: "column", fontSize: "0.875rem", gap: 2}}>
            {label}
            {children}
        </label>
    );
}

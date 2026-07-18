/**
 * Compact inline container creation: a toggle button that expands a
 * form with only the required fields (Nr., Typ, Eigentümer,
 * Bezeichnung), following the "step 1 = required fields only" UX rule.
 * Optional fields (Beschreibung, Ort, Größengruppe) stay on the
 * ContainerList edit form.
 *
 * Used on pages where the user picks a target container and the
 * container may not exist yet (photo intake). Creation needs a
 * backend (Dexie is a read-through cache), so callers pass
 * ``disabled`` while no backend answers.
 *
 * Testid namespace: `container-quick-create-*` with the slots
 * `toggle`, `form`, `external-id`, `type`, `owner`, `label`,
 * `submit`, `cancel`.
 */

import {useState} from "react";
import {Plus} from "lucide-react";

import {api} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {indexUpsertContainer} from "../search/buildIndex";
import {notify, errorMessage} from "../utils/notify";
import {btn, btnPrimary, input} from "../ui/classes";
import type {Container, ContainerType, Owner} from "../types/topos";

interface ContainerQuickCreateProps {
    /** Disable the toggle (e.g. while no backend answers). */
    disabled?: boolean;
    /** Called with the created container; the caller selects/refreshes. */
    onCreated: (created: Container) => void;
}

interface QuickFormState {
    externalId: string;
    type: ContainerType;
    owner: Owner;
    label: string;
}

// Photo intake mostly catalogues boxes, so "box" is the quick default;
// the full ContainerList form keeps its "folder" default.
const EMPTY_FORM: QuickFormState = {
    externalId: "",
    type: "box",
    owner: "self",
    label: "",
};

export default function ContainerQuickCreate({
    disabled = false,
    onCreated,
}: ContainerQuickCreateProps) {
    const {t} = useI18n();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<QuickFormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    function close() {
        setOpen(false);
        setForm(EMPTY_FORM);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!form.label.trim()) {
            notify.warning(
                t("topos.page.containers.label_required", "Bezeichnung ist erforderlich."),
            );
            return;
        }
        const externalId = Number(form.externalId.trim());
        if (!form.externalId.trim() || !Number.isInteger(externalId)) {
            notify.warning(
                t("topos.page.containers.external_id_invalid", "Nr. muss eine ganze Zahl sein."),
            );
            return;
        }
        setSaving(true);
        try {
            const created = await api.containers.create({
                externalId,
                type: form.type,
                owner: form.owner,
                label: form.label.trim(),
                description: null,
                location: null,
                sizeGroup: null,
            });
            indexUpsertContainer(created);
            notify.success(t("topos.toast.container_created", "Container erstellt"));
            close();
            onCreated(created);
        } catch (err) {
            notify.error(
                errorMessage(
                    err,
                    t(
                        "topos.toast.container_save_failed",
                        "Container konnte nicht gespeichert werden",
                    ),
                ),
                err,
            );
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return (
            <button
                type="button"
                data-testid="container-quick-create-toggle"
                className={btn}
                disabled={disabled}
                onClick={() => setOpen(true)}
            >
                <Plus size={16} aria-hidden />
                {t("topos.page.containers.new_container", "Neuer Container")}
            </button>
        );
    }

    return (
        <form
            data-testid="container-quick-create-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 border border-line rounded p-3"
        >
            <h3 className="m-0 text-base font-semibold">
                {t("topos.page.containers.create_title", "Neuer Container")}
            </h3>
            <div className="flex flex-wrap gap-2">
                <label className="flex flex-col gap-1 text-sm w-24">
                    {t("topos.container.external_id", "Nr.")}
                    <input
                        type="number"
                        className={input}
                        data-testid="container-quick-create-external-id"
                        value={form.externalId}
                        onChange={(e) =>
                            setForm((f) => ({...f, externalId: e.target.value}))
                        }
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    {t("topos.container.type_label", "Typ")}
                    <select
                        className={input}
                        data-testid="container-quick-create-type"
                        value={form.type}
                        onChange={(e) =>
                            setForm((f) => ({...f, type: e.target.value as ContainerType}))
                        }
                    >
                        <option value="box">{t("topos.container.type.box", "Box")}</option>
                        <option value="folder">
                            {t("topos.container.type.folder", "Ordner")}
                        </option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    {t("topos.container.owner", "Eigentümer")}
                    <select
                        className={input}
                        data-testid="container-quick-create-owner"
                        value={form.owner}
                        onChange={(e) =>
                            setForm((f) => ({...f, owner: e.target.value as Owner}))
                        }
                    >
                        <option value="self">{t("topos.owner.self", "Ich")}</option>
                        <option value="parents">{t("topos.owner.parents", "Eltern")}</option>
                        <option value="shared">{t("topos.owner.shared", "Geteilt")}</option>
                    </select>
                </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
                {t("topos.container.label", "Bezeichnung")}
                <input
                    type="text"
                    className={input}
                    data-testid="container-quick-create-label"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({...f, label: e.target.value}))}
                />
            </label>
            <div className="flex gap-2">
                <button
                    type="submit"
                    className={btnPrimary}
                    data-testid="container-quick-create-submit"
                    disabled={saving}
                >
                    {saving
                        ? t("topos.common.saving", "Speichere...")
                        : t("topos.common.save", "Speichern")}
                </button>
                <button
                    type="button"
                    className={btn}
                    data-testid="container-quick-create-cancel"
                    onClick={close}
                >
                    {t("topos.common.cancel", "Abbrechen")}
                </button>
            </div>
        </form>
    );
}

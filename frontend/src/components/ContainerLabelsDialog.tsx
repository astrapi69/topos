/**
 * Select containers and print QR labels (one QR per container encoding its
 * public detail URL). Prints via a hidden iframe + window.print() so the user
 * can "Save as PDF" or print onto a label sheet.
 */

import {useState} from "react";

import {Printer} from "lucide-react";

import type {Container} from "../types/topos";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {printContainerLabels} from "../utils/printLabels";
import {btn, btnPrimary} from "../ui/classes";

export default function ContainerLabelsDialog({
    containers,
    onClose,
}: {
    containers: Container[];
    onClose: () => void;
}) {
    const {t} = useI18n();
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const allSelected = containers.length > 0 && selected.size === containers.length;

    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(containers.map((c) => c.id)));
    }

    async function handlePrint() {
        const chosen = containers.filter((c) => selected.has(c.id));
        if (chosen.length === 0) return;
        setBusy(true);
        try {
            await printContainerLabels(chosen, {
                documentTitle: t("topos.page.containers.labels_doc_title", "Topos Etiketten"),
                idLabel: t("topos.container.external_id", "Nr."),
            });
            onClose();
        } catch (err) {
            notify.error(
                errorMessage(
                    err,
                    t("topos.page.containers.labels_failed", "Etiketten konnten nicht erstellt werden"),
                ),
                err,
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="container-labels-title"
            data-testid="container-labels-dialog"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-line bg-surface p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="container-labels-title" className="mb-3 text-lg font-semibold text-ink">
                    {t("topos.page.containers.labels_title", "Container-Etiketten")}
                </h2>

                <label className="mb-2 flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        data-testid="container-labels-select-all"
                    />
                    {t("topos.page.containers.labels_select_all", "Alle auswählen")}
                </label>

                <ul
                    className="flex flex-1 flex-col gap-1 overflow-y-auto"
                    style={{listStyle: "none", padding: 0, margin: 0}}
                >
                    {containers.map((container) => (
                        <li key={container.id}>
                            <label
                                className="flex items-center gap-2"
                                data-testid={`container-labels-item-${container.id}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(container.id)}
                                    onChange={() => toggle(container.id)}
                                />
                                <span className="font-mono">{container.externalId}</span>
                                <span className="truncate">{container.label}</span>
                            </label>
                        </li>
                    ))}
                </ul>

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        className={btnPrimary}
                        onClick={handlePrint}
                        disabled={busy || selected.size === 0}
                        data-testid="container-labels-print"
                    >
                        <Printer size={16} aria-hidden />
                        {t("topos.page.containers.labels_print", "Drucken")}
                    </button>
                    <button
                        type="button"
                        className={btn}
                        onClick={onClose}
                        data-testid="container-labels-cancel"
                    >
                        {t("topos.common.cancel", "Abbrechen")}
                    </button>
                </div>
            </div>
        </div>
    );
}

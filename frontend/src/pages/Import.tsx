/**
 * Excel import page.
 *
 * Drag-and-drop xlsx file -> POST /import/excel -> show
 * ImportReport summary card. On success, refresh every cached
 * table so the next page navigation reflects the new state.
 */

import {useState} from "react";

import NavBar from "../components/NavBar";
import {api} from "../api/client";
import {refreshAll} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useDialog} from "../components/AppDialog";
import {notify, errorMessage} from "../utils/notify";
import {rebuildSearchIndex} from "../search/buildIndex";
import {btnPrimary} from "../ui/classes";
import type {ImportReport} from "../types/topos";

export default function Import() {
    const {t} = useI18n();
    const [file, setFile] = useState<File | null>(null);
    const [pruneMissing, setPruneMissing] = useState(false);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [dragging, setDragging] = useState(false);
    const {confirm} = useDialog();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!file) return;
        if (pruneMissing) {
            const ok = await confirm(
                t("topos.confirm.prune_title", "Fehlende Einträge löschen?"),
                t(
                    "topos.confirm.prune_message",
                    "Einträge, die nicht mehr in der Excel-Datei stehen, werden dauerhaft aus der Datenbank gelöscht.",
                ),
                "danger",
                {
                    confirmLabel: t("topos.page.import.upload", "Hochladen"),
                    cancelLabel: t("topos.common.cancel", "Abbrechen"),
                },
            );
            if (!ok) return;
        }
        setSubmitting(true);
        setReport(null);
        try {
            const result = await api.importExcel(file, {pruneMissing});
            setReport(result);
            await refreshAll();
            await rebuildSearchIndex();
            notify.success(
                t("topos.toast.import_done", "Import abgeschlossen"),
            );
        } catch (err) {
            notify.error(errorMessage(err, t("topos.toast.import_failed", "Import fehlgeschlagen")), err);
        } finally {
            setSubmitting(false);
        }
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) setFile(dropped);
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: 720}}>
                <h1 data-testid="import-title">{t("topos.page.import.title", "Excel-Import")}</h1>
                <p>
                    {t(
                        "topos.page.import.description",
                        "Lade eine Ordner-Ordnung.xlsx (oder kompatible Datei) hoch. Der Importer ist idempotent.",
                    )}
                </p>

                <form onSubmit={handleSubmit} data-testid="import-form">
                    <div
                        data-testid="import-dropzone"
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        style={{
                            border: `2px dashed ${dragging ? "#0066cc" : "var(--border)"}`,
                            padding: "2rem",
                            textAlign: "center",
                            borderRadius: 6,
                            marginBottom: "1rem",
                            background: dragging ? "var(--accent-light)" : "transparent",
                        }}
                    >
                        {file ? (
                            <p data-testid="import-file-name">{file.name}</p>
                        ) : (
                            <p>
                                {t(
                                    "topos.page.import.drop_hint",
                                    "Datei hierher ziehen oder auswählen",
                                )}
                            </p>
                        )}
                        <input
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            data-testid="import-file-input"
                            style={{marginTop: "0.5rem"}}
                        />
                    </div>

                    <label
                        data-testid="import-prune-toggle"
                        style={{display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem"}}
                    >
                        <input
                            type="checkbox"
                            checked={pruneMissing}
                            onChange={(e) => setPruneMissing(e.target.checked)}
                            data-testid="import-prune-checkbox"
                        />
                        {t(
                            "topos.page.import.prune_missing",
                            "Fehlende Einträge aus der DB entfernen",
                        )}
                    </label>

                    <button
                        type="submit"
                        className={btnPrimary}
                        disabled={!file || submitting}
                        data-testid="import-submit"
                    >
                        {submitting
                            ? t("topos.page.import.uploading", "Wird hochgeladen...")
                            : t("topos.page.import.upload", "Hochladen")}
                    </button>
                </form>

                {report && (
                    <section
                        data-testid="import-report"
                        style={{
                            border: "1px solid var(--accent)",
                            borderRadius: 6,
                            padding: "1rem",
                            marginTop: "1.5rem",
                            background: "var(--accent-light)",
                        }}
                    >
                        <h2>{t("topos.page.import.report_title", "Importbericht")}</h2>
                        <dl
                            style={{
                                display: "grid",
                                gridTemplateColumns: "max-content auto",
                                gap: "0.25rem 0.75rem",
                            }}
                        >
                            <ReportRow
                                label={t("topos.import.report.containers_created", "Container neu")}
                                value={report.containersCreated}
                                testId="report-containers-created"
                            />
                            <ReportRow
                                label={t("topos.import.report.containers_updated", "Container aktualisiert")}
                                value={report.containersUpdated}
                                testId="report-containers-updated"
                            />
                            <ReportRow
                                label={t("topos.import.report.items_created", "Einträge neu")}
                                value={report.itemsCreated}
                                testId="report-items-created"
                            />
                            <ReportRow
                                label={t("topos.import.report.items_updated", "Einträge aktualisiert")}
                                value={report.itemsUpdated}
                                testId="report-items-updated"
                            />
                            <ReportRow
                                label={t("topos.import.report.items_pruned", "Einträge entfernt")}
                                value={report.itemsPruned}
                                testId="report-items-pruned"
                            />
                            <ReportRow
                                label={t("topos.import.report.actions_created", "Aktionen neu")}
                                value={report.actionsCreated}
                                testId="report-actions-created"
                            />
                            <ReportRow
                                label={t("topos.import.report.categories_created", "Kategorien neu")}
                                value={report.categoriesCreated}
                                testId="report-categories-created"
                            />
                        </dl>
                        {report.warnings.length > 0 && (
                            <details
                                data-testid="report-warnings"
                                style={{marginTop: "0.75rem"}}
                                open
                            >
                                <summary>
                                    {t("topos.import.report.warnings", "Warnungen")} ({report.warnings.length})
                                </summary>
                                <ul>
                                    {report.warnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </section>
                )}
            </main>
        </>
    );
}

function ReportRow({
    label,
    value,
    testId,
}: {
    label: string;
    value: number;
    testId: string;
}) {
    return (
        <>
            <dt>{label}</dt>
            <dd data-testid={testId} style={{margin: 0, fontWeight: 600}}>
                {value}
            </dd>
        </>
    );
}

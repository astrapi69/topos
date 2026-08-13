/**
 * Data export / import section for Settings.
 *
 * Export downloads a .topos.json backup; import validates a picked file, shows
 * a preview (stats + source), then merges or replaces (typed-confirm on
 * replace). The path (backend API vs Dexie) is chosen automatically by
 * exportToposData / importToposData - see src/backup/.
 */

import { useRef, useState } from "react";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useFeature } from "@astrapi69/feature-strategy-react";

import {
  BackupValidationError,
  downloadBackup,
  downloadExcelBackup,
  exportToposData,
  importToposData,
  readBackupFile,
  type ImportMode,
  type ToposBackup,
} from "../backup";
import { api } from "../api/client";
import { importWorkbook } from "../excel/importWorkbook";
import { FEATURES } from "../features/featureConfig";
import { useI18n } from "../hooks/useI18n";
import { refreshAll } from "../hooks/useTopos";
import { rebuildSearchIndex } from "../search/buildIndex";
import { getStorage } from "../storage";
import { useDialog } from "./AppDialog";
import { notify, errorMessage } from "../utils/notify";
import { btn, btnDanger, card, muted } from "../ui/classes";

/**
 * xlsx (like every OOXML file) is a ZIP archive, and ZIP starts with the
 * four bytes PK\x03\x04. Content, not name: on iOS the name is routinely
 * lost in transit, which is exactly how a workbook ends up in this picker.
 */
async function isZipFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return (
    head.length === 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    head[2] === 0x03 &&
    head[3] === 0x04
  );
}

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replace(`{${key}}`, String(value)),
    template,
  );
}

export default function DataSection() {
  const { t } = useI18n();
  const { prompt } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ToposBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const importFeature = useFeature(FEATURES.EXCEL_IMPORT);

  async function handleExport() {
    setBusy(true);
    try {
      const backup = await exportToposData();
      const total =
        backup.stats.containers +
        backup.stats.items +
        backup.stats.categories +
        backup.stats.actions;
      if (total === 0) {
        notify.warning(
          t("topos.page.settings.data.empty", "Keine Daten zum Exportieren"),
        );
        return;
      }
      downloadBackup(backup);
      notify.success(
        fill(
          t(
            "topos.page.settings.data.export_success",
            "Export abgeschlossen. {containers} Container, {items} Einträge.",
          ),
          { containers: backup.stats.containers, items: backup.stats.items },
        ),
      );
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t("topos.page.settings.data.invalid_file", "Ungültige Backup-Datei"),
        ),
        err,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelExport() {
    setBusy(true);
    try {
      const backup = await exportToposData();
      const total =
        backup.stats.containers +
        backup.stats.items +
        backup.stats.categories +
        backup.stats.actions;
      if (total === 0) {
        notify.warning(
          t("topos.page.settings.data.empty", "Keine Daten zum Exportieren"),
        );
        return;
      }
      await downloadExcelBackup(backup);
      notify.success(
        fill(
          t(
            "topos.page.settings.data.excel_export_success",
            "Excel-Export abgeschlossen. {containers} Container, {items} Einträge.",
          ),
          { containers: backup.stats.containers, items: backup.stats.items },
        ),
      );
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t(
            "topos.page.settings.data.excel_export_failed",
            "Excel-Export fehlgeschlagen",
          ),
        ),
        err,
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * A picked workbook runs the same dual-mode import as the Import page.
   * Users land here with an xlsx because the button says "Daten
   * importieren" - answering "Ungueltige Backup-Datei" to a valid export
   * of this very app was a dead end. No prune option from here: the
   * upsert is idempotent and non-destructive.
   */
  async function runExcelImport(file: File) {
    setBusy(true);
    try {
      const report = importFeature.isActive
        ? await api.importExcel(file, { pruneMissing: false })
        : await importWorkbook(await file.arrayBuffer(), getStorage(), {
            pruneMissing: false,
          });
      await refreshAll();
      await rebuildSearchIndex();
      notify.success(
        fill(
          t(
            "topos.page.settings.data.excel_import_success",
            "Excel-Import abgeschlossen. {containers} Container, {items} Einträge.",
          ),
          {
            containers: report.containersCreated + report.containersUpdated,
            items: report.itemsCreated + report.itemsUpdated,
          },
        ),
      );
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t("topos.toast.import_failed", "Import fehlgeschlagen"),
        ),
        err,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (await isZipFile(file)) {
      await runExcelImport(file);
      return;
    }
    try {
      setPending(await readBackupFile(file));
    } catch (err) {
      if (
        err instanceof BackupValidationError &&
        err.code === "unsupported_version"
      ) {
        notify.error(
          fill(
            t(
              "topos.page.settings.data.unsupported_version",
              "Backup-Version {version} wird nicht unterstützt",
            ),
            { version: err.version ?? "?" },
          ),
        );
      } else {
        notify.error(
          t("topos.page.settings.data.invalid_file", "Ungültige Backup-Datei"),
          err,
        );
      }
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await importToposData(pending, mode);
      notify.success(
        fill(
          t(
            "topos.page.settings.data.import_success",
            "Import abgeschlossen. {count} Einträge importiert.",
          ),
          { count: result.imported },
        ),
      );
      setPending(null);
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t("topos.page.settings.data.invalid_file", "Ungültige Backup-Datei"),
        ),
        err,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace() {
    if (!pending) return;
    const keyword = t("topos.page.settings.data.replace_keyword", "ERSETZEN");
    const answer = await prompt(
      t("topos.page.settings.data.import_replace", "Ersetzen"),
      t(
        "topos.page.settings.data.import_replace_confirm",
        "Alle bestehenden Daten werden gelöscht. Tippe ERSETZEN zum Bestätigen.",
      ),
      keyword,
    );
    if (
      answer != null &&
      answer.trim().toUpperCase() === keyword.toUpperCase()
    ) {
      await runImport("replace");
    }
  }

  return (
    <section style={{ marginBottom: "1.5rem" }} data-testid="data-section">
      <h2>{t("topos.page.settings.data.title", "Daten")}</h2>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={handleExport}
          disabled={busy}
          data-testid="data-export"
        >
          <Download size={16} aria-hidden />
          {t("topos.page.settings.data.export", "Daten exportieren")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={handleExcelExport}
          disabled={busy}
          data-testid="data-export-excel"
        >
          <FileSpreadsheet size={16} aria-hidden />
          {t("topos.page.settings.data.export_excel", "Excel exportieren")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          data-testid="data-import"
        >
          <Upload size={16} aria-hidden />
          {t("topos.page.settings.data.import", "Daten importieren")}
        </button>
        <input
          ref={fileRef}
          type="file"
          // No accept filter - see Import.tsx: iOS greys out files whose
          // name lost its extension, and the restore validates content.
          hidden
          onChange={onFilePicked}
          aria-label={t("topos.page.settings.data.import", "Daten importieren")}
          data-testid="data-import-input"
        />
      </div>

      {pending && (
        <div className={`${card} mt-3 p-3`} data-testid="data-import-preview">
          <p>
            {fill(
              t(
                "topos.page.settings.data.import_preview",
                "{containers} Container, {items} Einträge, {categories} Kategorien, {actions} Aktionen",
              ),
              {
                containers: pending.stats.containers,
                items: pending.stats.items,
                categories: pending.stats.categories,
                actions: pending.stats.actions,
              },
            )}
          </p>
          <p className={`${muted} text-sm`} data-testid="data-import-source">
            {pending.source}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => runImport("merge")}
              disabled={busy}
              data-testid="data-import-merge"
            >
              {t("topos.page.settings.data.import_merge", "Zusammenführen")}
            </button>
            <button
              type="button"
              className={btnDanger}
              onClick={handleReplace}
              disabled={busy}
              data-testid="data-import-replace"
            >
              {t("topos.page.settings.data.import_replace", "Ersetzen")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

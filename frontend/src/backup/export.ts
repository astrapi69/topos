/**
 * Data export. Backend mode (local backend running) pulls an authoritative
 * snapshot from the existing Python endpoint; offline/PWA mode reads Dexie
 * directly. The path is chosen automatically by isBackendAvailable().
 */

import { api } from "../api/client";
import { db } from "../db/schema";
import { isBackendAvailable } from "../utils/backendStatus";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupSource,
  type ToposBackup,
  type ToposBackupData,
} from "./types";

/** Wrap the four Dexie tables in a backup envelope (offline path). */
export function buildBackup(
  data: ToposBackupData,
  source: BackupSource,
): ToposBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion:
      typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
    buildHash: typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "unknown",
    source,
    data,
    stats: {
      containers: data.containers.length,
      items: data.items.length,
      categories: data.categories.length,
      actions: data.actions.length,
    },
  };
}

/** Produce a full backup from the active source (backend API or Dexie). */
export async function exportToposData(): Promise<ToposBackup> {
  if (await isBackendAvailable()) {
    return api.backup.export();
  }
  const [containers, items, categories, actions] = await Promise.all([
    db.containers.toArray(),
    db.items.toArray(),
    db.categories.toArray(),
    db.actions.toArray(),
  ]);
  return buildBackup({ containers, items, categories, actions }, "dexie");
}

/** Trigger a browser download of the backup as topos-backup-YYYY-MM-DD.topos.json. */
export function downloadBackup(backup: ToposBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `topos-backup-${date}.topos.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

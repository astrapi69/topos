/**
 * Types + constants for the Topos data backup (.topos.json).
 *
 * A backup is a full snapshot of the four Dexie tables plus a small metadata
 * envelope. Everything runs client-side (Dexie is the source in the offline
 * PWA; in backend mode it is the cache and re-syncs on the next fetch), so
 * there is no backend involved.
 */

import type {ActionRow, Category, Container, Item} from "../types/topos";

export const BACKUP_FORMAT = "topos-backup";
export const BACKUP_VERSION = 1;

/** Where the exported data was read from. */
export type BackupSource = "backend" | "dexie";

export interface ToposBackupData {
    containers: Container[];
    items: Item[];
    categories: Category[];
    actions: ActionRow[];
}

export interface ToposBackupStats {
    containers: number;
    items: number;
    categories: number;
    actions: number;
}

export interface ToposBackup {
    format: typeof BACKUP_FORMAT;
    version: number;
    exportedAt: string;
    appVersion: string;
    buildHash: string;
    source: BackupSource;
    data: ToposBackupData;
    stats: ToposBackupStats;
}

export type ImportMode = "merge" | "replace";

export interface ImportResult {
    imported: number;
    skipped: number;
}

/** Shape returned by the backend POST /api/backup/import endpoint. */
export interface BackendImportResult {
    mode: ImportMode;
    imported: ToposBackupStats;
    errors: string[];
}

/** Why a file was rejected before import. `code` maps to an i18n message. */
export class BackupValidationError extends Error {
    constructor(
        public code: "invalid_file" | "invalid_format" | "unsupported_version",
        public version?: number,
    ) {
        super(code);
        this.name = "BackupValidationError";
    }
}

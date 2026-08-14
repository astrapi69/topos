/**
 * Data import. Backend mode delegates to the existing Python endpoint and then
 * refreshes the Dexie cache; offline/PWA mode writes IndexedDB directly.
 *
 * Offline conflict resolution:
 *   - replace: clear all four tables first, then insert everything.
 *   - merge: upsert containers by externalId and categories by path
 *     (overwrite existing); append items deduped by (containerId, content) and
 *     actions by (itemId, text). Merge assumes a same-device id space (the
 *     recovery case: re-import a backup after a browser cache clear); replace
 *     is the robust cross-anything path.
 */

import { api } from "../api/client";
import { db } from "../db/schema";
import { refreshAll } from "../hooks/useTopos";
import { rebuildSearchIndex } from "../search/buildIndex";
import { isBackendAvailable } from "../utils/backendStatus";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupValidationError,
  type ImportMode,
  type ImportResult,
  type ToposBackup,
  type ToposBackupData,
} from "./types";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Validate a parsed object as a Topos backup envelope; throws on failure. */
export function validateBackup(parsed: unknown): ToposBackup {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BackupValidationError("invalid_file");
  }
  const record = parsed as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT) {
    throw new BackupValidationError("invalid_format");
  }
  const version = typeof record.version === "number" ? record.version : NaN;
  if (!Number.isFinite(version) || version > BACKUP_VERSION) {
    throw new BackupValidationError(
      "unsupported_version",
      Number.isFinite(version) ? version : undefined,
    );
  }
  const rawData = record.data;
  if (typeof rawData !== "object" || rawData === null) {
    throw new BackupValidationError("invalid_file");
  }
  const dataRecord = rawData as Record<string, unknown>;
  // The envelope is validated; the arrays are trusted as the row shapes the
  // app itself wrote on export. Missing arrays coerce to [].
  const data: ToposBackupData = {
    containers: asArray(dataRecord.containers) as ToposBackupData["containers"],
    items: asArray(dataRecord.items) as ToposBackupData["items"],
    categories: asArray(dataRecord.categories) as ToposBackupData["categories"],
    actions: asArray(dataRecord.actions) as ToposBackupData["actions"],
  };
  return { ...(record as unknown as ToposBackup), data };
}

/** Read + validate a picked file. */
export async function readBackupFile(file: File): Promise<ToposBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupValidationError("invalid_file");
  }
  return validateBackup(parsed);
}

/** Import a validated backup via the active path (backend API or Dexie). */
export async function importToposData(
  backup: ToposBackup,
  mode: ImportMode,
): Promise<ImportResult> {
  if (await isBackendAvailable()) {
    const result = await api.backup.import(backup, mode);
    await refreshAll(); // pull the authoritative state back into the cache
    const counts = result.imported;
    return {
      imported:
        counts.containers + counts.items + counts.categories + counts.actions,
      skipped: result.errors.length,
    };
  }
  return importIntoDexie(backup.data, mode);
}

async function importIntoDexie(
  data: ToposBackupData,
  mode: ImportMode,
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  await db.transaction(
    "rw",
    db.containers,
    db.items,
    db.categories,
    db.actions,
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.containers.clear(),
          db.items.clear(),
          db.categories.clear(),
          db.actions.clear(),
        ]);
      }

      const catByPath = new Map(
        (await db.categories.toArray()).map((row) => [row.path, row.id]),
      );
      for (const cat of data.categories) {
        const existingId = catByPath.get(cat.path);
        await db.categories.put(
          existingId != null ? { ...cat, id: existingId } : cat,
        );
        imported++;
      }

      const contByExt = new Map(
        (await db.containers.toArray()).map((row) => [row.externalId, row.id]),
      );
      // backup-file id -> final id in this store, for relinking parents.
      const contIdRemap = new Map<number, number>();
      for (const cont of data.containers) {
        const existingId = contByExt.get(cont.externalId);
        const finalId = existingId ?? cont.id;
        contIdRemap.set(cont.id, finalId);
        await db.containers.put({ ...cont, id: finalId });
        imported++;
      }
      // Second pass: parentContainerId in the file is a BACKUP id and the
      // parent may appear later in the list, so links resolve only after
      // every container has its final id. Unresolvable -> top level.
      for (const cont of data.containers) {
        const finalId = contIdRemap.get(cont.id);
        if (finalId == null) continue;
        const parentFinal =
          cont.parentContainerId != null
            ? (contIdRemap.get(cont.parentContainerId) ?? null)
            : null;
        await db.containers.update(finalId, {
          parentContainerId: parentFinal === finalId ? null : parentFinal,
        });
      }

      const itemKeys = new Set(
        (await db.items.toArray()).map(
          (row) => `${row.containerId}\u0000${row.content}`,
        ),
      );
      for (const item of data.items) {
        const key = `${item.containerId}\u0000${item.content}`;
        if (itemKeys.has(key)) {
          skipped++;
          continue;
        }
        await db.items.put(item);
        itemKeys.add(key);
        imported++;
      }

      const actionKeys = new Set(
        (await db.actions.toArray()).map(
          (row) => `${row.itemId}\u0000${row.text}`,
        ),
      );
      for (const action of data.actions) {
        const key = `${action.itemId}\u0000${action.text}`;
        if (actionKeys.has(key)) {
          skipped++;
          continue;
        }
        await db.actions.put(action);
        actionKeys.add(key);
        imported++;
      }
    },
  );
  await rebuildSearchIndex();
  return { imported, skipped };
}

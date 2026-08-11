/**
 * Offline Excel import: parse an Ordner-Ordnung workbook in the browser
 * and upsert it through the storage service.
 *
 * The backend plugin (`topos-plugin-excel-import`) does the same job
 * server-side; this is the no-backend path so the GitHub Pages PWA can
 * import too. Both read the same four-sheet contract and apply the same
 * match keys, so a workbook lands identically in either mode - verified
 * in both directions (a file written by one side imports losslessly on
 * the other):
 *
 *   Container  matched by externalId
 *   Item       matched by (containerId, content)
 *   Action     matched by (itemId, text) - inserted, never reset, so a
 *              completed action survives a re-import
 *   Category   matched by path, ancestors created as needed
 *
 * `pruneMissing` deletes items of a matched container that the sheet no
 * longer lists. Off by default, mirroring the backend flag.
 *
 * Columns beyond the original layout (notes, category slug, owner, size
 * group, box priority, encoded action state) and the "Kategorien" sheet
 * are all OPTIONAL: a workbook from an older version, or one written by
 * hand, still imports with the previous semantics.
 *
 * exceljs is loaded via dynamic import so it stays in the lazy chunk it
 * already occupies for the export side.
 */

import { priorityFromGerman, slugifyCategoryPath } from "./mappings";
import type { CategorySegment } from "./mappings";
import type { IStorageService } from "../storage/types";
import type {
  ActionStatus,
  Category,
  ContainerType,
  Owner,
  Priority,
} from "../types/topos";

const SHEET_MEINE_ORDNER = "Meine Ordner";
const SHEET_ORDNER_ELTERN = "Ordner Eltern";
const SHEET_BOXEN = "Boxen";
const SHEET_KATEGORIEN = "Kategorien";

const RANGE_HEADER_RE = /^\s*(\d+)\s+bis\s+(\d+)\s*$/i;
const NEGATIVE_ACTION_VALUES = new Set(["", "keine", "nein", "no", "none"]);

export interface ImportReport {
  containersCreated: number;
  containersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsPruned: number;
  actionsCreated: number;
  categoriesCreated: number;
  warnings: string[];
}

interface ParsedAction {
  text: string;
  status: ActionStatus;
  completedAt: string | null;
  dueDate: string | null;
}

interface ParsedItem {
  content: string;
  priority: Priority;
  categoryPath: string | null;
  categorySegments: CategorySegment[];
  notes: string | null;
  actions: ParsedAction[];
}

/** One row of the optional "Kategorien" sheet. */
interface ParsedCategory {
  path: string;
  displayName: string;
  parentPath: string | null;
  level: number;
}

interface ParsedContainer {
  externalId: number;
  type: ContainerType;
  owner: Owner;
  label: string;
  location: string | null;
  sizeGroup: string | null;
  descriptionLines: string[];
  items: ParsedItem[];
}

interface ParseResult {
  containers: ParsedContainer[];
  categories: ParsedCategory[];
  warnings: string[];
}

/** A worksheet row reduced to trimmed strings, 0-indexed by column. */
type Row = (string | null)[];

function emptyReport(warnings: string[]): ImportReport {
  return {
    containersCreated: 0,
    containersUpdated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsPruned: 0,
    actionsCreated: 0,
    categoriesCreated: 0,
    warnings,
  };
}

function cellStr(row: Row, index: number): string | null {
  const value = row[index];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

/** Integers only: a non-numeric or fractional cell is not a container id. */
function cellInt(row: Row, index: number): number | null {
  const raw = cellStr(row, index);
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

/**
 * Decode one action token written by the exporter's `encodeAction`.
 *
 * The bracket suffix is only read as flags when its content parses as
 * known tokens, so "Regal [oben]" stays a plain open action instead of
 * losing its brackets.
 */
function decodeAction(token: string): ParsedAction {
  const match = /^(.*?)\s*\[([^\]]*)\]$/.exec(token);
  if (match === null) {
    return { text: token, status: "open", completedAt: null, dueDate: null };
  }
  const [, text, flagBlob] = match;
  const flags = flagBlob.split("|").map((flag) => flag.trim());
  let status: ActionStatus | null = null;
  let completedAt: string | null = null;
  let dueDate: string | null = null;
  for (const flag of flags) {
    const done = /^erledigt(?:@(.+))?$/.exec(flag);
    const archived = /^archiviert(?:@(.+))?$/.exec(flag);
    const due = /^faellig:(.+)$/.exec(flag);
    if (done) {
      status = "done";
      completedAt = done[1] ?? null;
    } else if (archived) {
      status = "archived";
      completedAt = archived[1] ?? null;
    } else if (due) {
      dueDate = due[1];
    } else {
      // Unknown bracket content: not ours, keep the token verbatim.
      return { text: token, status: "open", completedAt: null, dueDate: null };
    }
  }
  return { text, status: status ?? "open", completedAt, dueDate };
}

/** Read the owner column; null when absent so the sheet decides. */
function parseOwner(raw: string | null): Owner | null {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  return value === "self" || value === "parents" || value === "shared"
    ? (value as Owner)
    : null;
}

function splitActions(raw: string | null): ParsedAction[] {
  if (raw === null) return [];
  if (NEGATIVE_ACTION_VALUES.has(raw.trim().toLowerCase())) return [];
  return raw
    .split(";")
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map(decodeAction);
}

/**
 * Pair an explicit slug path with the German display path so each level
 * keeps its display name. Falls back to the slug when the display path
 * has fewer segments (hand-edited file).
 */
function segmentsFromSlugPath(
  slugPath: string,
  displayCell: string | null,
): CategorySegment[] {
  const displays = (displayCell ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return slugPath
    .split("/")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .map((slug, index) => ({ slug, display: displays[index] ?? slug }));
}

function buildItem(
  content: string,
  priorityCell: string | null,
  categoryCell: string | null,
  actionCell: string | null,
  notesCell: string | null,
  slugPathCell: string | null,
  warnings: string[],
): ParsedItem {
  const { priority, warning } = priorityFromGerman(priorityCell);
  if (warning) warnings.push(warning);

  // The slug column is authoritative when present: it preserves a slug
  // that the German display name would not reproduce. Without it (legacy
  // workbook, hand-written file) the display path is slugified as before.
  let categoryPath: string | null = null;
  let categorySegments: CategorySegment[] = [];
  if (slugPathCell) {
    categoryPath = slugPathCell;
    categorySegments = segmentsFromSlugPath(slugPathCell, categoryCell);
  } else {
    const slugged = slugifyCategoryPath(categoryCell);
    if (slugged) {
      warnings.push(...slugged.warnings);
      categoryPath = slugged.path;
      categorySegments = slugged.segments;
    }
  }

  return {
    content,
    priority,
    categoryPath,
    categorySegments,
    notes: notesCell,
    actions: splitActions(actionCell),
  };
}

/** "Meine Ordner" / "Ordner Eltern": a numeric col 0 opens a container. */
function parseOwnerSheet(
  rows: Row[],
  options: {
    owner: Owner;
    containerType: ContainerType;
    hasLocation: boolean;
    hasActions: boolean;
    sheetName: string;
  },
  result: ParseResult,
): void {
  let current: ParsedContainer | null = null;
  for (const row of rows) {
    const externalId = cellInt(row, 0);
    const col1 = cellStr(row, 1);
    const col2 = cellStr(row, 2);
    const col3 = cellStr(row, 3);
    const col4 = cellStr(row, 4);
    // Columns 5-6 exist on both folder sheets since the layout grew; a
    // legacy "Ordner Eltern" simply leaves them empty.
    const col5 = cellStr(row, 5);
    const col6 = cellStr(row, 6);
    const notes = cellStr(row, 7);
    const slugPath = cellStr(row, 8);
    const ownerCell = cellStr(row, 9);
    const sizeGroupCell = cellStr(row, 10);

    if (externalId !== null) {
      current = {
        externalId,
        type: options.containerType,
        // The owner column wins when present; otherwise the sheet decides
        // (which is why "shared" needed a column - it shares a sheet).
        owner: parseOwner(ownerCell) ?? options.owner,
        label: col1 ?? `Container ${externalId}`,
        location: col5,
        sizeGroup: sizeGroupCell,
        descriptionLines: [],
        items: [],
      };
      result.containers.push(current);
      continue;
    }

    if (current === null) {
      if (col1 || col2) {
        result.warnings.push(
          `Zeile vor dem ersten Container übersprungen (${options.sheetName})`,
        );
      }
      continue;
    }

    if (col2 !== null) {
      current.items.push(
        buildItem(col2, col3, col4, col6, notes, slugPath, result.warnings),
      );
      continue;
    }

    if (col1 !== null) current.descriptionLines.push(col1);
  }
}

/** "Boxen": numeric col 0 opens a box, "<lo> bis <hi>" sets the size group. */
function parseBoxSheet(rows: Row[], result: ParseResult): void {
  let currentSizeGroup: string | null = null;
  let current: ParsedContainer | null = null;
  for (const row of rows) {
    const col0Int = cellInt(row, 0);
    const col0Str = cellStr(row, 0);
    const col1 = cellStr(row, 1);
    const col4 = cellStr(row, 4);
    const col5 = cellStr(row, 5);
    const actionCell = cellStr(row, 6);
    const notes = cellStr(row, 7);
    const slugPath = cellStr(row, 8);
    const priorityCell = cellStr(row, 9);
    const ownerCell = cellStr(row, 10);

    if (col0Str !== null && col0Int === null) {
      const match = RANGE_HEADER_RE.exec(col0Str);
      if (match !== null) {
        currentSizeGroup = `${match[1]} bis ${match[2]}`;
        continue;
      }
      if (current === null || col4 === null) {
        result.warnings.push(
          `Zeile ohne Boxnummer übersprungen (Boxen): "${col0Str}"`,
        );
        continue;
      }
    }

    if (col0Int !== null) {
      current = {
        externalId: col0Int,
        type: "box",
        owner: parseOwner(ownerCell) ?? "self",
        label: col1 ?? `Box ${col0Int}`,
        location: null,
        sizeGroup: currentSizeGroup,
        descriptionLines: [],
        items: [],
      };
      result.containers.push(current);
      continue;
    }

    if (current === null) {
      if (col4) {
        result.warnings.push(
          `Eintrag vor der ersten Box übersprungen (Boxen): "${col4}"`,
        );
      }
      continue;
    }

    if (col4 !== null) {
      current.items.push(
        buildItem(
          col4,
          priorityCell,
          col5,
          actionCell,
          notes,
          slugPath,
          result.warnings,
        ),
      );
    }
  }
}

/** Read a worksheet into plain string rows, skipping the header row. */
function sheetRows(worksheet: {
  eachRow: (cb: (row: { values: unknown }, rowNumber: number) => void) => void;
}): Row[] {
  const rows: Row[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    // exceljs `values` is 1-based with a leading hole; drop it so the
    // column indices match the backend parser's 0-based tuple.
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(
      values.map((value) =>
        value === null || value === undefined ? null : String(value),
      ),
    );
  });
  return rows;
}

/** Optional "Kategorien" sheet: the taxonomy verbatim. */
function parseCategorySheet(rows: Row[]): ParsedCategory[] {
  const parsed: ParsedCategory[] = [];
  for (const row of rows) {
    const path = cellStr(row, 0);
    if (path === null) continue;
    const level = cellInt(row, 3);
    parsed.push({
      path,
      displayName: cellStr(row, 1) ?? path.split("/").pop() ?? path,
      parentPath: cellStr(row, 2),
      level: level ?? path.split("/").length - 1,
    });
  }
  return parsed;
}

async function parseWorkbook(source: ArrayBuffer): Promise<ParseResult> {
  const excelJsModule = await import("exceljs");
  const ExcelJS = excelJsModule.default ?? excelJsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);

  const result: ParseResult = { containers: [], categories: [], warnings: [] };
  const mine = workbook.getWorksheet(SHEET_MEINE_ORDNER);
  if (mine) {
    parseOwnerSheet(
      sheetRows(mine),
      {
        owner: "self",
        containerType: "folder",
        hasLocation: true,
        hasActions: true,
        sheetName: SHEET_MEINE_ORDNER,
      },
      result,
    );
  } else {
    result.warnings.push(`Tabellenblatt "${SHEET_MEINE_ORDNER}" fehlt`);
  }

  const parents = workbook.getWorksheet(SHEET_ORDNER_ELTERN);
  if (parents) {
    parseOwnerSheet(
      sheetRows(parents),
      {
        owner: "parents",
        containerType: "folder",
        hasLocation: false,
        hasActions: false,
        sheetName: SHEET_ORDNER_ELTERN,
      },
      result,
    );
  }

  const boxes = workbook.getWorksheet(SHEET_BOXEN);
  if (boxes) parseBoxSheet(sheetRows(boxes), result);

  const categorySheet = workbook.getWorksheet(SHEET_KATEGORIEN);
  if (categorySheet) {
    result.categories = parseCategorySheet(sheetRows(categorySheet));
  }

  return result;
}

/** Expand segments into one (path, display, level) triple per ancestor. */
function ancestorChain(
  segments: CategorySegment[],
): { path: string; display: string; level: number }[] {
  const out: { path: string; display: string; level: number }[] = [];
  const prefix: string[] = [];
  segments.forEach((segment, level) => {
    prefix.push(segment.slug);
    out.push({ path: prefix.join("/"), display: segment.display, level });
  });
  return out;
}

async function ensureCategories(
  storage: IStorageService,
  segments: CategorySegment[],
  known: Map<string, Category>,
  report: ImportReport,
): Promise<void> {
  let parentPath: string | null = null;
  for (const { path, display, level } of ancestorChain(segments)) {
    if (!known.has(path)) {
      const created = await storage.categories.create({
        path,
        parentPath,
        name: path.split("/").pop() ?? path,
        displayName: display,
        level,
      });
      known.set(path, created);
      report.categoriesCreated += 1;
    }
    parentPath = path;
  }
}

function joinDescription(lines: string[]): string | null {
  const joined = lines.filter(Boolean).join("\n");
  return joined || null;
}

/**
 * Parse and upsert an Ordner-Ordnung workbook through the storage
 * service. Safe to run repeatedly: the same file imported twice leaves
 * the store unchanged.
 */
export async function importWorkbook(
  source: ArrayBuffer,
  storage: IStorageService,
  options: { pruneMissing?: boolean } = {},
): Promise<ImportReport> {
  const parsed = await parseWorkbook(source);
  const report = emptyReport([...parsed.warnings]);

  const existingContainers = await storage.containers.list();
  const containersByExternalId = new Map(
    existingContainers.map((container) => [container.externalId, container]),
  );
  const knownCategories = new Map(
    (await storage.categories.list()).map((category) => [
      category.path,
      category,
    ]),
  );

  // The "Kategorien" sheet is the authority for the taxonomy: it carries
  // display names and keeps categories that no item references. Create
  // them first (parents before children) so item rows only ever find
  // existing paths.
  for (const parsedCategory of [...parsed.categories].sort(
    (a, b) => a.level - b.level || a.path.localeCompare(b.path),
  )) {
    if (knownCategories.has(parsedCategory.path)) continue;
    const created = await storage.categories.create({
      path: parsedCategory.path,
      parentPath: parsedCategory.parentPath,
      name: parsedCategory.path.split("/").pop() ?? parsedCategory.path,
      displayName: parsedCategory.displayName,
      level: parsedCategory.level,
    });
    knownCategories.set(parsedCategory.path, created);
    report.categoriesCreated += 1;
  }

  for (const parsedContainer of parsed.containers) {
    const payload = {
      externalId: parsedContainer.externalId,
      type: parsedContainer.type,
      owner: parsedContainer.owner,
      label: parsedContainer.label,
      description: joinDescription(parsedContainer.descriptionLines),
      location: parsedContainer.location,
      sizeGroup: parsedContainer.sizeGroup,
    };

    let container = containersByExternalId.get(parsedContainer.externalId);
    if (container === undefined) {
      container = await storage.containers.create(payload);
      containersByExternalId.set(container.externalId, container);
      report.containersCreated += 1;
    } else {
      container = await storage.containers.update(container.id, payload);
      containersByExternalId.set(container.externalId, container);
      report.containersUpdated += 1;
    }

    const existingItems = await storage.items.list({
      containerId: container.id,
    });
    const itemsByContent = new Map(
      existingItems.map((item) => [item.content, item]),
    );
    const seen = new Set<string>();

    for (const parsedItem of parsedContainer.items) {
      await ensureCategories(
        storage,
        parsedItem.categorySegments,
        knownCategories,
        report,
      );
      const itemPayload = {
        content: parsedItem.content,
        priority: parsedItem.priority,
        categoryPath: parsedItem.categoryPath,
        notes: parsedItem.notes,
      };
      let item = itemsByContent.get(parsedItem.content);
      if (item === undefined) {
        item = await storage.items.create({
          containerId: container.id,
          ...itemPayload,
        });
        report.itemsCreated += 1;
      } else {
        item = await storage.items.update(item.id, itemPayload);
        report.itemsUpdated += 1;
      }
      seen.add(parsedItem.content);

      if (parsedItem.actions.length > 0) {
        // Existing actions keep their status: only genuinely new texts are
        // inserted (a completed action must not reopen on re-import). The
        // status/dates travel in the cell, so a fresh import restores them.
        const existingActions = await storage.actions.list();
        const taken = new Set(
          existingActions
            .filter((action) => action.itemId === item.id)
            .map((action) => action.text),
        );
        for (const action of parsedItem.actions) {
          if (taken.has(action.text)) continue;
          await storage.actions.create({
            itemId: item.id,
            text: action.text,
            status: action.status,
            dueDate: action.dueDate,
            completedAt: action.completedAt,
          });
          report.actionsCreated += 1;
        }
      }
    }

    if (options.pruneMissing) {
      for (const [content, item] of itemsByContent) {
        if (seen.has(content)) continue;
        await storage.items.delete(item.id);
        report.itemsPruned += 1;
      }
    }
  }

  return report;
}

/**
 * Offline Excel import: parse an Ordner-Ordnung workbook in the browser
 * and upsert it through the storage service.
 *
 * The backend plugin (`topos-plugin-excel-import`) does the same job
 * server-side; this is the no-backend path so the GitHub Pages PWA can
 * import too. Both read the same three-sheet contract and apply the same
 * match keys, so a workbook lands identically in either mode:
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
 * exceljs is loaded via dynamic import so it stays in the lazy chunk it
 * already occupies for the export side.
 */

import { priorityFromGerman, slugifyCategoryPath } from "./mappings";
import type { CategorySegment } from "./mappings";
import type { IStorageService } from "../storage/types";
import type { Category, ContainerType, Owner, Priority } from "../types/topos";

const SHEET_MEINE_ORDNER = "Meine Ordner";
const SHEET_ORDNER_ELTERN = "Ordner Eltern";
const SHEET_BOXEN = "Boxen";

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

interface ParsedItem {
  content: string;
  priority: Priority;
  categoryPath: string | null;
  categorySegments: CategorySegment[];
  actionTexts: string[];
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

function splitActions(raw: string | null): string[] {
  if (raw === null) return [];
  if (NEGATIVE_ACTION_VALUES.has(raw.trim().toLowerCase())) return [];
  return raw
    .split(";")
    .map((piece) => piece.trim())
    .filter(Boolean);
}

function buildItem(
  content: string,
  priorityCell: string | null,
  categoryCell: string | null,
  actionCell: string | null,
  warnings: string[],
): ParsedItem {
  const { priority, warning } = priorityFromGerman(priorityCell);
  if (warning) warnings.push(warning);
  const slugged = slugifyCategoryPath(categoryCell);
  if (slugged) warnings.push(...slugged.warnings);
  return {
    content,
    priority,
    categoryPath: slugged?.path ?? null,
    categorySegments: slugged?.segments ?? [],
    actionTexts: splitActions(actionCell),
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
    const col5 = options.hasLocation ? cellStr(row, 5) : null;
    const col6 = options.hasActions ? cellStr(row, 6) : null;

    if (externalId !== null) {
      current = {
        externalId,
        type: options.containerType,
        owner: options.owner,
        label: col1 ?? `Container ${externalId}`,
        location: col5,
        sizeGroup: null,
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
      current.items.push(buildItem(col2, col3, col4, col6, result.warnings));
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
        owner: "self",
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
      current.items.push(buildItem(col4, null, col5, null, result.warnings));
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

async function parseWorkbook(source: ArrayBuffer): Promise<ParseResult> {
  const excelJsModule = await import("exceljs");
  const ExcelJS = excelJsModule.default ?? excelJsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);

  const result: ParseResult = { containers: [], warnings: [] };
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

      if (parsedItem.actionTexts.length > 0) {
        // Existing actions keep their status: only genuinely new texts
        // are inserted (a completed action must not reopen on re-import).
        const existingActions = await storage.actions.list();
        const taken = new Set(
          existingActions
            .filter((action) => action.itemId === item.id)
            .map((action) => action.text),
        );
        for (const text of parsedItem.actionTexts) {
          if (taken.has(text)) continue;
          await storage.actions.create({ itemId: item.id, text });
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

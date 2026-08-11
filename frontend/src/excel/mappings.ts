/**
 * German -> English value maps for the offline Excel importer.
 *
 * A faithful port of the backend plugin's `topos_excel_import/mappings.py`
 * so a workbook imports identically with or without a backend. Keep the
 * two in sync: a segment added there belongs here too (and vice versa),
 * otherwise the same file produces different category slugs depending on
 * which mode the user is in.
 */

import type { Priority } from "../types/topos";

const PRIORITY_MAP: Record<string, Priority> = {
  "sehr hoch": "very_high",
  hoch: "high",
  mittel: "medium",
  niedrig: "low",
  keine: "none",
  "": "none",
};

export interface PriorityResult {
  priority: Priority;
  /** Non-null when the cell matched no known value (surfaced in the report). */
  warning: string | null;
}

/** Translate an Excel priority cell to a Topos priority value. */
export function priorityFromGerman(raw: string | null): PriorityResult {
  if (raw === null || raw === undefined)
    return { priority: "none", warning: null };
  const key = raw.trim().toLowerCase();
  const mapped = PRIORITY_MAP[key];
  if (mapped !== undefined) return { priority: mapped, warning: null };
  return {
    priority: "none",
    warning: `Unbekannte Priorität "${raw}" - auf "keine" gesetzt`,
  };
}

/**
 * Known category segments. Unmapped segments still yield a valid slug via
 * the mechanical fallback; an entry here just gives a clean English slug.
 */
const CATEGORY_SLUG_MAP: Record<string, string> = {
  Finanzen: "finance",
  Bank: "bank",
  Girokonto: "checking-account",
  Aktien: "stocks",
  Ausland: "foreign",
  Griechenland: "greece",
  Konto: "account",
  Ordnung: "organization",
  Hilfsmittel: "supplies",
  Versicherung: "insurance",
  Versicherungen: "insurances",
  Steuern: "taxes",
  Steuer: "tax",
  Gesundheit: "health",
  Familie: "family",
  Wohnung: "apartment",
  Haus: "house",
  Auto: "car",
  Arbeit: "work",
  Beruf: "profession",
  Vertrag: "contract",
  Vertraege: "contracts",
  Rechnung: "invoice",
  Rechnungen: "invoices",
  Quittung: "receipt",
  Quittungen: "receipts",
  Dokument: "document",
  Dokumente: "documents",
  Brief: "letter",
  Briefe: "letters",
};

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
};

/** Lowercase, transliterate umlauts, collapse the rest to hyphens. */
function mechanicalSlug(segment: string): string {
  const transliterated = segment
    .replace(/[äöüßÄÖÜ]/g, (char) => UMLAUTS[char] ?? char)
    .toLowerCase();
  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

export interface CategorySegment {
  slug: string;
  /** The original German cell text; becomes Category.displayName. */
  display: string;
}

export interface SlugifiedPath {
  path: string;
  segments: CategorySegment[];
  warnings: string[];
}

/**
 * Convert an Excel category cell ("Finanzen / Bank") into a slugged path
 * plus per-level display names. Returns null for an empty cell; empty
 * intermediate segments (trailing or doubled slashes) are dropped.
 */
export function slugifyCategoryPath(raw: string | null): SlugifiedPath | null {
  if (raw === null || raw === undefined) return null;
  const stripped = String(raw).trim();
  if (!stripped) return null;

  const segments: CategorySegment[] = [];
  const warnings: string[] = [];
  for (const rawSegment of stripped.split("/")) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const mapped = CATEGORY_SLUG_MAP[segment];
    if (mapped !== undefined) {
      segments.push({ slug: mapped, display: segment });
      continue;
    }
    const slug = mechanicalSlug(segment);
    warnings.push(
      `Unbekannte Kategorie "${segment}" - als "${slug}" übernommen`,
    );
    segments.push({ slug, display: segment });
  }

  if (segments.length === 0) return null;
  return {
    path: segments.map((segment) => segment.slug).join("/"),
    segments,
    warnings,
  };
}

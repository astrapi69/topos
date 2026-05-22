"""German -> English value maps for the Topos Excel importer.

Two lookups live here:

- ``PRIORITY_MAP``: Excel priority strings ("sehr hoch", "hoch", ...)
  to the Topos ``Priority`` enum.
- ``CATEGORY_SLUG_MAP``: per-segment German -> kebab-case English
  slug. ``slugify_category_path`` applies it segment by segment;
  unmapped segments fall back to a mechanical slugifier (lowercase,
  umlauts transliterated, spaces -> hyphens).

The slugifier also extracts a parallel list of original-German
segments so callers can build ``Category.display_name`` and
``Category.parent_path`` without re-parsing the source string.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Avoid importing app.models at module import time: the plugin
# package may be imported in environments where ``app`` is not on
# sys.path (e.g. ``pip install ...`` from outside the backend). The
# concrete Priority enum is resolved lazily inside ``priority_from_german``.


PRIORITY_MAP: dict[str, str] = {
    "sehr hoch": "very_high",
    "hoch": "high",
    "mittel": "medium",
    "niedrig": "low",
    "keine": "none",
    "": "none",
}


def priority_from_german(raw: str | None) -> tuple[str, str | None]:
    """Translate an Excel priority cell to a Topos ``Priority`` value.

    Returns a ``(priority_value, warning)`` tuple. ``warning`` is non-
    ``None`` when the input did not match any known mapping; the
    caller decides whether to surface it in the import report.
    """
    if raw is None:
        return ("none", None)
    key = raw.strip().lower()
    if key in PRIORITY_MAP:
        return (PRIORITY_MAP[key], None)
    return ("none", f"Unknown priority value: {raw!r} -> defaulted to none")


# Known segments. Authored as the importer encounters them; unmapped
# segments still produce a valid slug via the mechanical fallback,
# but adding an entry here improves SEO / URL readability and gives
# the future search code a stable key to anchor on.
CATEGORY_SLUG_MAP: dict[str, str] = {
    "Finanzen": "finance",
    "Bank": "bank",
    "Girokonto": "checking-account",
    "Aktien": "stocks",
    "Ausland": "foreign",
    "Griechenland": "greece",
    "Konto": "account",
    "Ordnung": "organization",
    "Hilfsmittel": "supplies",
    "Versicherung": "insurance",
    "Versicherungen": "insurances",
    "Steuern": "taxes",
    "Steuer": "tax",
    "Gesundheit": "health",
    "Familie": "family",
    "Wohnung": "apartment",
    "Haus": "house",
    "Auto": "car",
    "Arbeit": "work",
    "Beruf": "profession",
    "Vertrag": "contract",
    "Vertraege": "contracts",
    "Rechnung": "invoice",
    "Rechnungen": "invoices",
    "Quittung": "receipt",
    "Quittungen": "receipts",
    "Dokument": "document",
    "Dokumente": "documents",
    "Brief": "letter",
    "Briefe": "letters",
}


_UMLAUT_MAP = str.maketrans(
    {
        "ä": "ae",
        "ö": "oe",
        "ü": "ue",
        "ß": "ss",
        "Ä": "ae",
        "Ö": "oe",
        "Ü": "ue",
    }
)


def _mechanical_slug(segment: str) -> str:
    """Lowercase, transliterate umlauts, collapse non-alphanumerics
    to hyphens. The fallback when ``CATEGORY_SLUG_MAP`` has no
    entry for the segment."""
    transliterated = segment.translate(_UMLAUT_MAP).lower()
    # Replace any run of non-[a-z0-9] with a single hyphen, then trim.
    slug = re.sub(r"[^a-z0-9]+", "-", transliterated).strip("-")
    return slug or "unknown"


@dataclass(frozen=True)
class SlugifiedPath:
    """Result of ``slugify_category_path``.

    Attributes:
        path: The full slash-separated English slug
            (``"finance/bank/checking-account"``).
        segments: One ``(slug, display_name)`` pair per level, root
            first. ``display_name`` is the original German cell
            content for that segment.
        warnings: Segments that fell back to the mechanical slugifier
            (one warning string per unknown segment).
    """

    path: str
    segments: list[tuple[str, str]]
    warnings: list[str]


def slugify_category_path(raw: str | None) -> SlugifiedPath | None:
    """Convert an Excel category-path cell to a slugged path plus
    display-name segments.

    Returns ``None`` when the cell is empty or whitespace-only. Empty
    intermediate segments (e.g. trailing slashes, double slashes) are
    dropped silently.
    """
    if raw is None:
        return None
    stripped = str(raw).strip()
    if not stripped:
        return None

    segments: list[tuple[str, str]] = []
    warnings: list[str] = []
    for raw_segment in stripped.split("/"):
        segment = raw_segment.strip()
        if not segment:
            continue
        if segment in CATEGORY_SLUG_MAP:
            slug = CATEGORY_SLUG_MAP[segment]
        else:
            slug = _mechanical_slug(segment)
            warnings.append(
                f"Unmapped category segment {segment!r} -> slug {slug!r} "
                f"(add to CATEGORY_SLUG_MAP for a clean English slug)"
            )
        segments.append((slug, segment))

    if not segments:
        return None
    path = "/".join(slug for slug, _ in segments)
    return SlugifiedPath(path=path, segments=segments, warnings=warnings)

#!/usr/bin/env python3
"""Apply a translation map to the English catalog, safely.

``backend/config/i18n/en.yaml`` is the structural reference: every other
locale must carry exactly the same keys. This script rebuilds one locale
from it, replacing each English string with its translation, so a locale
can never drift in shape - only in wording.

Three guards, because a broken catalog is worse than an English one:

1. **Placeholder parity.** ``{count}``, ``{name}``, ``{path}`` and
   friends are substituted at runtime; a translation that drops or
   renames one silently prints a literal brace to the user. Mismatches
   abort the run.
2. **Coverage report.** Strings with no entry in the map stay English
   and are listed, so a partial map is visible rather than quietly
   shipped as "translated".
3. **Key parity.** The output is written from the English tree, so keys
   cannot be lost, added, or reordered by hand-editing.

Usage:
    python3 scripts/apply_translation.py es translations/es.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
I18N_DIR = REPO_ROOT / "backend" / "config" / "i18n"
PLACEHOLDER_RE = re.compile(r"\{[a-z_]+\}")


def translate_tree(node: Any, mapping: dict[str, str], missing: list[str]) -> Any:
    """Rebuild the tree with translated leaves, collecting untranslated ones."""
    if isinstance(node, dict):
        return {key: translate_tree(value, mapping, missing) for key, value in node.items()}
    if not isinstance(node, str):
        return node
    translated = mapping.get(node)
    if translated is None:
        missing.append(node)
        return node
    return translated


def check_placeholders(mapping: dict[str, str]) -> list[str]:
    """Report entries whose placeholders differ from the source string."""
    problems: list[str] = []
    for source, target in mapping.items():
        expected = sorted(PLACEHOLDER_RE.findall(source))
        actual = sorted(PLACEHOLDER_RE.findall(target))
        if expected != actual:
            problems.append(f"{source!r} -> {target!r}: expected {expected}, got {actual}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lang", help="target locale, e.g. es")
    parser.add_argument("map_file", help="JSON object: english -> translation")
    args = parser.parse_args()

    source_tree = yaml.safe_load((I18N_DIR / "en.yaml").read_text(encoding="utf-8"))
    mapping: dict[str, str] = json.loads(Path(args.map_file).read_text(encoding="utf-8"))

    problems = check_placeholders(mapping)
    if problems:
        print("Placeholder mismatch - refusing to write:", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1

    missing: list[str] = []
    translated = translate_tree(source_tree, mapping, missing)

    target = I18N_DIR / f"{args.lang}.yaml"
    target.write_text(
        yaml.safe_dump(translated, allow_unicode=True, sort_keys=False, width=1000),
        encoding="utf-8",
    )

    unique_missing = sorted(set(missing))
    print(f"Wrote {target.relative_to(REPO_ROOT)}")
    if unique_missing:
        print(f"Untranslated ({len(unique_missing)} unique), left in English:")
        for text in unique_missing[:20]:
            print(f"  {text!r}")
        if len(unique_missing) > 20:
            print(f"  ... and {len(unique_missing) - 20} more")
    else:
        print("Full coverage.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

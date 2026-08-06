"""Topos Excel-import plugin.

Imports an Ordner-Ordnung.xlsx file (or any compatible workbook with
the same three-sheet shape) into the Topos database.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    # Derived from the installed distribution metadata (pyproject version),
    # never a hardcoded literal - see the version-pin SSoT rule.
    __version__ = version("topos-plugin-excel-import")
except PackageNotFoundError:  # not installed as a distribution
    __version__ = "0.0.0+unknown"

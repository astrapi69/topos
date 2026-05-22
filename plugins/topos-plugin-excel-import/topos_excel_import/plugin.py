"""PluginForge plugin class for the Excel importer."""

from __future__ import annotations

from typing import Any

from pluginforge import BasePlugin

from . import __version__
from .routes import router as import_router


class ExcelImportPlugin(BasePlugin):
    """Mounts ``POST /import/excel`` and the supporting helpers."""

    name = "excel_import"
    version = __version__
    target_application = "topos"
    description = (
        "Import an Ordner-Ordnung.xlsx file (or a compatible Topos seed "
        "workbook) into the Topos database. Idempotent on external_id; "
        "supports a --prune-missing flag for removing items that disappeared "
        "from the source sheet."
    )
    author = "Asterios Raptis"

    def get_routes(self) -> list[Any]:
        return [import_router]

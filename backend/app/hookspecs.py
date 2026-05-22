"""Topos hook specifications.

Defines the hooks that plugins can implement. Uses pluggy's
``HookspecMarker`` for type-safe hook dispatch.

The bootstrap registers a single placeholder hook so the plugin
manager can mount cleanly even with zero plugins. Phase 5 (Excel-
import plugin) and later domain plugins will extend this surface
with real hooks (e.g. ``inventory_import_excel``, ``qr_label_render``).
"""

from typing import Any

import pluggy

hookspec = pluggy.HookspecMarker("topos.plugins")


class ToposHookSpec:
    """Hook specifications for the Topos application."""

    @hookspec
    def app_ready(self, app_id: str, app_version: str) -> dict[str, Any] | None:  # type: ignore[empty-body]
        """Notify a plugin that the host application has finished booting.

        Plugins may return a small dict of diagnostic metadata for
        logging; the return value is not load-bearing.
        """
        ...

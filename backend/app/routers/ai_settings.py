"""AI provider settings API.

Read-only provider presets, per-provider key-source status (without
ever returning the key value), and a connectivity/key-validation probe
for the Settings "Test connection" button. Writing the AI config
(active provider, model, base URL, keys) goes through the existing
``PATCH /api/settings/app`` handler, which deep-merges and strips
externally-managed keys.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.ai import config as ai_config
from app.ai import connection as ai_connection
from app.ai.providers import ProviderPreset, list_providers

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings/ai", tags=["settings"])


class AiKeyStatus(BaseModel):
    """Where a provider's API key resolves from, without the value."""

    provider: str
    configured: bool
    source: str  # env | secrets_yaml | app_yaml | none
    externally_managed: bool


class AiTestRequest(BaseModel):
    """Body for the connection probe.

    ``api_key`` / ``base_url`` are optional: when omitted the probe uses
    the values already resolved from the config chain, so the user can
    test a stored key without retyping it.
    """

    provider: str
    api_key: str | None = None
    base_url: str | None = None


class AiTestResult(BaseModel):
    ok: bool
    error_code: str | None = None


def _merged_config() -> dict[str, Any]:
    from app.main import _load_app_config

    return _load_app_config()


def _secrets_path():
    from app.main import _get_user_override_path

    return _get_user_override_path()


@router.get("/providers", response_model=list[ProviderPreset])
def get_ai_providers() -> list[ProviderPreset]:
    """Return the built-in provider presets (with vision-flagged models)."""
    return list_providers()


@router.get("/key-status", response_model=list[AiKeyStatus])
def get_ai_key_status() -> list[AiKeyStatus]:
    """Per-provider key source for the Settings UI (no key values)."""
    merged = _merged_config()
    secrets_path = _secrets_path()
    return [
        AiKeyStatus(
            **ai_config.get_ai_key_status(preset.id, secrets_yaml_path=secrets_path, config=merged)
        )
        for preset in list_providers()
    ]


@router.post("/test", response_model=AiTestResult)
def test_ai_connection(body: AiTestRequest) -> AiTestResult:
    """Validate a provider's API key with a cheap models-list probe."""
    merged = _merged_config()
    ai_block = ai_config.get_ai_config(merged)
    api_key = body.api_key or ai_block.get("keys", {}).get(body.provider, "") or ""
    base_url = body.base_url or ai_block.get("base_urls", {}).get(body.provider, "") or ""
    result = ai_connection.test_connection(body.provider, api_key=api_key, base_url=base_url)
    logger.info(
        "AI connection test: provider=%s ok=%s error=%s",
        body.provider,
        result["ok"],
        result["error_code"],
    )
    return AiTestResult(**result)

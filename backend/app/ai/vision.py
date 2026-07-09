"""Vision recognition service for the photo-intake feature.

Resolves the user's AI configuration (provider, model, base URL, API
key) from the merged app config, assembles the backend-owned prompt,
and dispatches to the matching provider client. Routing is by
``active_provider`` from Settings, never by model-id prefix - the
``custom`` provider (local Ollama / LM Studio) has no usable prefix.

Raises typed domain errors only; the router stays thin and the global
exception handler maps them (``ValidationError`` -> 400,
``RateLimitError`` -> 429, ``ExternalServiceError`` -> 502).
"""

from __future__ import annotations

import base64
import logging
from typing import Any

from app.ai.config import get_active_provider, get_ai_config, is_ai_enabled
from app.ai.providers import get_provider
from app.ai.vision_clients import (
    recognize_anthropic,
    recognize_google,
    recognize_openai,
)
from app.ai.vision_prompt import build_vision_prompt, select_categories_for_prompt
from app.ai.vision_schemas import VisionResult
from app.exceptions import ValidationError

logger = logging.getLogger(__name__)

ALLOWED_MEDIA_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def validate_image_upload(media_type: str | None, byte_count: int) -> str:
    """Validate an uploaded photo before it costs an AI call.

    Args:
        media_type: The upload's content type (may carry parameters).
        byte_count: Size of the uploaded payload.

    Returns:
        The normalized media type (e.g. ``image/jpeg``).

    Raises:
        ValidationError: On unsupported type or empty payload.
    """
    normalized = (media_type or "").split(";")[0].strip().lower()
    if normalized not in ALLOWED_MEDIA_TYPES:
        raise ValidationError(
            f"Unsupported image type {normalized or 'unknown'!r} - use JPEG, PNG or WebP"
        )
    if byte_count == 0:
        raise ValidationError("Uploaded image is empty")
    return normalized


def recognize_photo(
    *,
    image_bytes: bytes,
    media_type: str,
    container_type: str,
    categories: list[str],
    config: dict[str, Any] | None = None,
) -> VisionResult:
    """Recognize the items on a container photo via the active provider.

    Args:
        image_bytes: The (client-side downscaled) photo.
        media_type: Normalized image MIME type.
        container_type: ``box`` or ``folder``; steers the prompt focus.
        categories: All existing category paths (reduced token-aware
            before they enter the prompt).
        config: Merged app config; loaded fresh when ``None``.

    Returns:
        ``VisionResult`` with the resolved provider/model and the
        validated item suggestions.

    Raises:
        ValidationError: AI disabled or provider config incomplete.
        RateLimitError: Provider rate limit hit.
        ExternalServiceError: Provider/network failure or unparseable
            model output.
    """
    if config is None:
        from app.main import _load_app_config

        config = _load_app_config()
    if not is_ai_enabled(config):
        raise ValidationError("AI features are disabled - enable them in Settings")

    provider_id, api_key, base_url, model = _resolve_provider_config(config)
    prompt = build_vision_prompt(container_type, select_categories_for_prompt(categories))
    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    logger.info(
        "Vision recognition via %s (%s), image %d bytes, %d categories in prompt",
        provider_id,
        model,
        len(image_bytes),
        len(categories),
    )

    client_kwargs = {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "image_b64": image_b64,
        "media_type": media_type,
        "prompt": prompt,
    }
    if provider_id == "anthropic":
        recognized = recognize_anthropic(**client_kwargs)
    elif provider_id == "google":
        recognized = recognize_google(**client_kwargs)
    else:
        # openai + custom share the OpenAI-compatible wire format.
        recognized = recognize_openai(provider=provider_id, **client_kwargs)
    return VisionResult(provider=provider_id, model=model, items=recognized)


def _resolve_provider_config(config: dict[str, Any]) -> tuple[str, str, str, str]:
    """Resolve ``(provider_id, api_key, base_url, model)`` from Settings.

    Raises:
        ValidationError: When the active provider is unknown or its
            key / base URL / model is missing.
    """
    ai_block = get_ai_config(config)
    provider_id = get_active_provider(config)
    preset = get_provider(provider_id)
    if preset is None:
        raise ValidationError(f"Unknown AI provider {provider_id!r}")

    api_key = str((ai_block.get("keys") or {}).get(provider_id) or "").strip()
    if preset.requires_api_key and not api_key:
        raise ValidationError(
            f"No API key configured for provider {provider_id!r} - add one in Settings"
        )

    base_url = str((ai_block.get("base_urls") or {}).get(provider_id) or "").strip()
    base_url = base_url or preset.base_url
    if not base_url:
        raise ValidationError(f"Provider {provider_id!r} needs a base URL - set it in Settings")

    model = str((ai_block.get("models") or {}).get(provider_id) or "").strip()
    model = model or preset.default_model
    if not model:
        raise ValidationError(
            f"No model configured for provider {provider_id!r} - pick one in Settings"
        )
    return provider_id, api_key, base_url, model

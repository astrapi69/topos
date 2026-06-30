"""Built-in AI provider presets.

Each preset describes a provider the Settings UI can offer: its
display label, the API base URL, a list of suggested models (with a
``vision`` flag so the UI can mark or filter image-capable models),
and the environment variable that overrides its API key.

These are *presets*, not the user's configuration. The user's actual
choice (active provider, selected model per provider, custom base URL,
API keys) lives in the merged app config under the ``ai`` block - see
``app.ai.config``.
"""

from __future__ import annotations

from pydantic import BaseModel


class ModelOption(BaseModel):
    """A single model offered for a provider.

    Attributes:
        id: The provider's model identifier sent on the wire.
        label: Human-readable label for the dropdown.
        vision: True when the model accepts image input. The box-content
            recognition feature requires this, so the UI marks
            non-vision models.
    """

    id: str
    label: str
    vision: bool


class ProviderPreset(BaseModel):
    """Static description of an AI provider.

    Attributes:
        id: Stable provider key (``anthropic``/``openai``/``google``/``custom``).
        label: Display name for the provider selector.
        base_url: Default API base URL. Empty for ``custom`` (user supplies it).
        default_model: The model pre-selected when the provider is chosen.
            For built-in providers this is always a vision-capable model.
        models: Suggested models. Empty for ``custom`` (free-form entry).
        env_var: Environment variable that overrides this provider's API
            key in the secrets chain (e.g. ``TOPOS_ANTHROPIC_API_KEY``).
        requires_api_key: False only for providers reachable without a key
            (none of the built-ins today; kept for local endpoints).
        requires_base_url: True when the user MUST supply a base URL
            (the ``custom`` slot, e.g. a local Ollama instance).
        note: Optional UI hint (e.g. "vision support depends on the model").
    """

    id: str
    label: str
    base_url: str
    default_model: str
    models: list[ModelOption]
    env_var: str
    requires_api_key: bool = True
    requires_base_url: bool = False
    note: str = ""


# Vision-capable model suggestions per provider. Kept intentionally
# short: the dropdown allows free-text entry, so this is a curated
# starting set, not an exhaustive catalogue. All built-in defaults are
# vision-capable because the headline feature is image recognition.
_ANTHROPIC = ProviderPreset(
    id="anthropic",
    label="Anthropic (Claude)",
    base_url="https://api.anthropic.com/v1",
    default_model="claude-sonnet-4-6",
    env_var="TOPOS_ANTHROPIC_API_KEY",
    models=[
        ModelOption(id="claude-sonnet-4-6", label="Claude Sonnet 4.6", vision=True),
        ModelOption(id="claude-opus-4-8", label="Claude Opus 4.8", vision=True),
        ModelOption(id="claude-haiku-4-5-20251001", label="Claude Haiku 4.5", vision=True),
    ],
)

_OPENAI = ProviderPreset(
    id="openai",
    label="OpenAI (GPT)",
    base_url="https://api.openai.com/v1",
    default_model="gpt-4o-mini",
    env_var="TOPOS_OPENAI_API_KEY",
    models=[
        ModelOption(id="gpt-4o-mini", label="GPT-4o mini", vision=True),
        ModelOption(id="gpt-4o", label="GPT-4o", vision=True),
    ],
)

_GOOGLE = ProviderPreset(
    id="google",
    label="Google (Gemini)",
    base_url="https://generativelanguage.googleapis.com/v1beta",
    default_model="gemini-2.0-flash",
    env_var="TOPOS_GEMINI_API_KEY",
    models=[
        ModelOption(id="gemini-2.0-flash", label="Gemini 2.0 Flash", vision=True),
        ModelOption(id="gemini-1.5-pro", label="Gemini 1.5 Pro", vision=True),
        ModelOption(id="gemini-1.5-flash", label="Gemini 1.5 Flash", vision=True),
    ],
)

_CUSTOM = ProviderPreset(
    id="custom",
    label="Custom (OpenAI-compatible)",
    base_url="",
    default_model="",
    env_var="TOPOS_CUSTOM_API_KEY",
    models=[],
    requires_base_url=True,
    note="vision_depends_on_model",
)


_PROVIDER_PRESETS: list[ProviderPreset] = [_ANTHROPIC, _OPENAI, _GOOGLE, _CUSTOM]
_PROVIDERS_BY_ID: dict[str, ProviderPreset] = {p.id: p for p in _PROVIDER_PRESETS}


def list_providers() -> list[ProviderPreset]:
    """Return all built-in provider presets in display order."""
    return list(_PROVIDER_PRESETS)


def get_provider(provider_id: str) -> ProviderPreset | None:
    """Return the preset for ``provider_id`` or ``None`` if unknown."""
    return _PROVIDERS_BY_ID.get(provider_id)


def is_known_provider(provider_id: str) -> bool:
    """True iff ``provider_id`` is one of the built-in providers."""
    return provider_id in _PROVIDERS_BY_ID

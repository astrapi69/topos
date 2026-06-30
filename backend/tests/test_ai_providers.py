"""Unit tests for the AI provider presets.

The headline AI feature is recognising box contents from a photo, so
every built-in provider's default model must be vision-capable and the
preset shape must stay stable for the Settings UI.
"""

from __future__ import annotations

from app.ai.providers import (
    get_provider,
    is_known_provider,
    list_providers,
)

_BUILTIN_VISION_PROVIDERS = ["anthropic", "openai", "google"]


def test_list_providers_includes_four_known_ids() -> None:
    ids = {p.id for p in list_providers()}
    assert ids == {"anthropic", "openai", "google", "custom"}


def test_provider_ids_are_unique() -> None:
    ids = [p.id for p in list_providers()]
    assert len(ids) == len(set(ids))


def test_builtin_default_model_is_vision_capable() -> None:
    """Each built-in provider's default model exists in its list and
    is flagged vision-capable - the recognition feature needs it."""
    for provider_id in _BUILTIN_VISION_PROVIDERS:
        preset = get_provider(provider_id)
        assert preset is not None
        by_id = {m.id: m for m in preset.models}
        assert preset.default_model in by_id, (
            f"{provider_id}: default_model {preset.default_model} not in models"
        )
        assert by_id[preset.default_model].vision is True


def test_builtin_providers_only_suggest_vision_models() -> None:
    """The curated suggestion lists are vision-only by design."""
    for provider_id in _BUILTIN_VISION_PROVIDERS:
        preset = get_provider(provider_id)
        assert preset is not None
        assert preset.models, f"{provider_id} has no suggested models"
        assert all(m.vision for m in preset.models)


def test_builtin_providers_carry_topos_env_var() -> None:
    expected = {
        "anthropic": "TOPOS_ANTHROPIC_API_KEY",
        "openai": "TOPOS_OPENAI_API_KEY",
        "google": "TOPOS_GEMINI_API_KEY",
        "custom": "TOPOS_CUSTOM_API_KEY",
    }
    for provider_id, env_var in expected.items():
        preset = get_provider(provider_id)
        assert preset is not None
        assert preset.env_var == env_var


def test_custom_provider_requires_base_url_and_has_no_models() -> None:
    custom = get_provider("custom")
    assert custom is not None
    assert custom.requires_base_url is True
    assert custom.base_url == ""
    assert custom.default_model == ""
    assert custom.models == []


def test_builtin_providers_ship_a_base_url() -> None:
    for provider_id in _BUILTIN_VISION_PROVIDERS:
        preset = get_provider(provider_id)
        assert preset is not None
        assert preset.base_url.startswith("https://")


def test_get_provider_unknown_returns_none() -> None:
    assert get_provider("does-not-exist") is None


def test_is_known_provider() -> None:
    assert is_known_provider("anthropic") is True
    assert is_known_provider("custom") is True
    assert is_known_provider("mistral") is False

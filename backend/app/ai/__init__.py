"""AI provider configuration for Topos.

This package owns the *settings* layer for AI providers (Anthropic,
OpenAI, Google Gemini, plus a free-form OpenAI-compatible ``custom``
slot). It deliberately holds NO LLM-client code and pulls in NO
provider SDK - the only purpose here is to let the user pick a
provider, store an API key (via the existing secrets chain), and
choose a model.

The primary Topos use case is vision/multimodal recognition of box
contents from a phone photo, so the built-in model suggestions favour
vision-capable models and flag each one accordingly.
"""

from app.ai.providers import (
    ModelOption,
    ProviderPreset,
    get_provider,
    is_known_provider,
    list_providers,
)

__all__ = [
    "ModelOption",
    "ProviderPreset",
    "get_provider",
    "is_known_provider",
    "list_providers",
]

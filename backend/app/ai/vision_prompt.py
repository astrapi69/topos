"""Prompt assembly for box-content recognition.

The template lives in the backend (never in the frontend) so every
caller - the PWA, future plugins, tests - sends the same instruction.
The JSON structure itself is enforced provider-natively (see
``vision_clients``); the prompt only carries the semantics of each
field plus the anti-hallucination rules.
"""

from __future__ import annotations

# Above this count the taxonomy no longer fits a prompt comfortably;
# fall back to the shallow (top-two-level) subset before truncating.
MAX_PROMPT_CATEGORIES = 100

_FOCUS_HINTS: dict[str, str] = {
    "box": "Focus on physical objects: tools, devices, household goods, containers.",
    "folder": (
        "Focus on documents: read titles, labels and headings on spines, covers and visible pages."
    ),
}
_DEFAULT_FOCUS_HINT = "Focus on clearly identifiable items."

VISION_PROMPT_TEMPLATE = """\
You are cataloguing the contents of a {container_type} for a personal inventory.
{focus_hint}

Report one entry per distinct, clearly visible item. Fields:
- label: short German name of the item.
- category_path: the single best match from the EXISTING categories listed
  below, or "" if none clearly fits. Do NOT invent categories here.
- new_category_hint: optional english-kebab-case proposal when no existing
  category fits, else "".
- description: brief German description of what is visible.
- confidence: 0.0 to 1.0 - your visual certainty only.

Existing categories: {categories}

Rules:
- Only list items you can clearly see. Never guess or infer hidden contents.
- When uncertain, use a confidence below 0.5.
- Prefer existing categories; new_category_hint is only a suggestion the
  user has to confirm.
- Respond with the structured item list as JSON only.
"""


def build_vision_prompt(container_type: str, categories: list[str]) -> str:
    """Assemble the vision prompt for one recognition request.

    Args:
        container_type: ``box`` or ``folder``; anything else gets a
            generic focus hint.
        categories: Existing category paths, already reduced via
            ``select_categories_for_prompt`` by the caller.

    Returns:
        The complete prompt string sent alongside the image.
    """
    joined = ", ".join(categories) if categories else "(none defined yet)"
    return VISION_PROMPT_TEMPLATE.format(
        container_type=container_type,
        focus_hint=_FOCUS_HINTS.get(container_type, _DEFAULT_FOCUS_HINT),
        categories=joined,
    )


def select_categories_for_prompt(
    paths: list[str], max_count: int = MAX_PROMPT_CATEGORIES
) -> list[str]:
    """Reduce a category taxonomy to a prompt-friendly subset.

    Token-aware selection: small taxonomies go in verbatim; large ones
    are reduced to the top two path levels (which is what a model can
    meaningfully match against anyway) and hard-capped at ``max_count``.

    Args:
        paths: All existing category paths (slash-separated slugs).
        max_count: Hard cap on the number of paths in the prompt.

    Returns:
        Sorted, de-duplicated subset of ``paths``.
    """
    unique_paths = sorted({path.strip() for path in paths if path and path.strip()})
    if len(unique_paths) <= max_count:
        return unique_paths
    shallow_paths = [path for path in unique_paths if path.count("/") <= 1]
    return shallow_paths[:max_count]

/**
 * Prompt assembly for browser-direct box-content recognition.
 *
 * Mirror of ``backend/app/ai/vision_prompt.py`` - keep the template
 * and the category-selection rules in sync. With a reachable backend
 * the prompt is assembled server-side (``POST /api/ai/vision``); this
 * mirror only serves the no-backend mode so recognition sends the
 * same instruction either way.
 */

/** Above this count the taxonomy no longer fits a prompt comfortably. */
export const MAX_PROMPT_CATEGORIES = 100;

const FOCUS_HINTS: Record<string, string> = {
    box: "Focus on physical objects: tools, devices, household goods, containers.",
    folder:
        "Focus on documents: read titles, labels and headings on spines, covers and visible pages.",
};
const DEFAULT_FOCUS_HINT = "Focus on clearly identifiable items.";

/** Assemble the vision prompt for one recognition request. */
export function buildVisionPrompt(containerType: string, categories: string[]): string {
    const joined = categories.length > 0 ? categories.join(", ") : "(none defined yet)";
    const focusHint = FOCUS_HINTS[containerType] ?? DEFAULT_FOCUS_HINT;
    return `You are cataloguing the contents of a ${containerType} for a personal inventory.
${focusHint}

Report one entry per distinct, clearly visible item. Fields:
- label: short German name of the item.
- category_path: the single best match from the EXISTING categories listed
  below, or "" if none clearly fits. Do NOT invent categories here.
- new_category_hint: optional english-kebab-case proposal when no existing
  category fits, else "".
- description: brief German description of what is visible.
- confidence: 0.0 to 1.0 - your visual certainty only.

Existing categories: ${joined}

Rules:
- Only list items you can clearly see. Never guess or infer hidden contents.
- When uncertain, use a confidence below 0.5.
- Prefer existing categories; new_category_hint is only a suggestion the
  user has to confirm.
- Respond with the structured item list as JSON only.
`;
}

/**
 * Reduce a category taxonomy to a prompt-friendly subset: small
 * taxonomies go in verbatim; large ones fall back to the top two path
 * levels, hard-capped at ``maxCount``.
 */
export function selectCategoriesForPrompt(
    paths: string[],
    maxCount: number = MAX_PROMPT_CATEGORIES,
): string[] {
    const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))].sort();
    if (uniquePaths.length <= maxCount) return uniquePaths;
    const shallowPaths = uniquePaths.filter(
        (path) => (path.match(/\//g) ?? []).length <= 1,
    );
    return shallowPaths.slice(0, maxCount);
}

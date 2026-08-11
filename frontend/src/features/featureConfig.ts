/**
 * Central feature registry + gating strategy for Topos (replaces scattered
 * ad-hoc backend/AI-availability checks with one declarative source).
 *
 * Design (the library's descriptor + abstention model):
 *   - Every feature is a descriptor with `defaultState: "active"`.
 *   - The strategy carries ONLY deviation rules. It abstains (returns
 *     `undefined`) for anything not in a gating class, so the descriptor
 *     default governs.
 *   - A feature's gating class is defined in exactly one place (its presence
 *     in a class list), never duplicated at the call site.
 *
 * State policy: features are never `hidden` here - everything the user owns is
 * visible, either active or disabled with a reason the UI localizes. `hidden`
 * stays reserved for the registry's fail-closed handling of unknown ids.
 *
 * The registry is a module constant (stateless config). Only the
 * {@link FeatureContext} changes at runtime, supplied - memoised - by the root
 * {@link AppFeatureProvider}. Conditions are pure synchronous lookups on that
 * context, because `useFeature` evaluates them lazily per consumer on render.
 *
 * Scope note: this first cut gates the two backend-required capabilities that
 * were previously ad-hoc (excel-import was in fact ungated; category-edit used
 * a local backendUp flag). The AI-key and CORS/browser-direct gates
 * (photo-intake, ai-browser-direct) still live in their pages / the
 * ai-key-vault kit; migrating them here is tracked as follow-up (see
 * docs/explorations/EXP-001). Only ids that are actually consumed are defined -
 * no dead config.
 */

import {
  ConditionalFeatureStrategy,
  type FeatureCondition,
  type FeatureDescriptor,
  type FeatureState,
  FeatureRegistry,
} from "@astrapi69/feature-strategy";

/** Evaluation context passed to the strategy through the FeatureProvider. */
export interface FeatureContext {
  /** True when the FastAPI backend answered a /health probe. */
  backendAvailable: boolean;
  /** True when a usable AI provider (backend or unlocked local vault) exists. */
  hasAiKey: boolean;
}

/**
 * Stable identifiers for every gateable feature. All call sites reference this
 * constant; feature ids are never spelled as string literals.
 */
export const FEATURES = {
  /**
   * Excel workbook import via the backend plugin (POST /api/import/excel).
   * Active means "a backend can do the parse+upsert"; when inactive the
   * Import page falls back to the browser parser (src/excel/importWorkbook)
   * writing through the storage service, so the feature is NOT gone
   * offline - only the path differs.
   */
  EXCEL_IMPORT: "excel-import",
  /** Category rename/delete (cascading writes) - needs the backend. */
  CATEGORY_EDIT: "category-edit",
} as const;

/** Union of all registered feature ids. */
export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Reason code for a feature disabled because no backend is reachable.
 * Components localize it via `feature.${reason}` (`feature.backend_required`).
 */
export const REASON_BACKEND_REQUIRED = "backend_required";

/** Backend-required features: disabled when no backend answers. */
const BACKEND_REQUIRED: readonly FeatureId[] = [
  FEATURES.EXCEL_IMPORT,
  FEATURES.CATEGORY_EDIT,
];

function backendRequiredRule(): FeatureCondition<FeatureContext> {
  return {
    evaluate: (context): FeatureState | undefined => {
      if (context === undefined) return undefined;
      return context.backendAvailable ? "active" : "disabled";
    },
    reason: REASON_BACKEND_REQUIRED,
  };
}

function buildRegistry(): FeatureRegistry<FeatureContext> {
  const descriptors: FeatureDescriptor[] = Object.values(FEATURES).map(
    (id) => ({
      id,
      defaultState: "active",
    }),
  );

  const rules: Record<
    string,
    FeatureCondition<FeatureContext>
  > = Object.fromEntries(
    BACKEND_REQUIRED.map((id) => [id, backendRequiredRule()] as const),
  );

  return new FeatureRegistry<FeatureContext>()
    .registerAll(descriptors)
    .setStrategy(new ConditionalFeatureStrategy<FeatureContext>(rules));
}

/**
 * The application-wide feature registry, wired into the React tree by the root
 * {@link AppFeatureProvider}.
 */
export const featureRegistry = buildRegistry();

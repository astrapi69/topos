/**
 * TestFeatureProvider - wraps children in the real feature registry with an
 * explicit, deterministic {@link FeatureContext} for unit tests.
 *
 * Use this instead of AppFeatureProvider when a test needs to drive a gate
 * directly (no async /api/health probe): pass the exact context the case
 * under test requires.
 */

import type {ReactNode} from "react";

import {FeatureProvider} from "@astrapi69/feature-strategy-react";

import {featureRegistry, type FeatureContext} from "./featureConfig";

const DEFAULT_CONTEXT: FeatureContext = {backendAvailable: true, hasAiKey: true};

export function TestFeatureProvider({
    context = DEFAULT_CONTEXT,
    children,
}: {
    context?: FeatureContext;
    children: ReactNode;
}) {
    return (
        <FeatureProvider registry={featureRegistry} context={context}>
            {children}
        </FeatureProvider>
    );
}

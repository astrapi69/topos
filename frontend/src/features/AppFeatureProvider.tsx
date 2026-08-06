/**
 * AppFeatureProvider - computes the runtime {@link FeatureContext} once and
 * feeds it to @astrapi69/feature-strategy-react's FeatureProvider.
 *
 * It owns the two inputs the gates read, so individual components no longer
 * probe for themselves:
 *   - backendAvailable: the shared /api/health probe (utils/backendStatus),
 *     re-evaluated on the `topos:data-refresh` event (fired when a backend is
 *     connected from Settings) - same pattern as OfflineBanner.
 *   - hasAiKey: whether a usable AI provider exists. In backend mode the
 *     backend holds the key (covered by backendAvailable); in no-backend mode
 *     it is the unlocked local vault (`resolveActiveProvider() !== null`).
 *
 * The context is memoised so its identity only changes when a value changes,
 * which is exactly when the kit re-evaluates every consumer.
 */

import {useEffect, useMemo, useState, type ReactNode} from "react";

import {FeatureProvider} from "@astrapi69/feature-strategy-react";

import {resolveActiveProvider} from "../ai";
import {isBackendAvailable} from "../utils/backendStatus";
import {featureRegistry, type FeatureContext} from "./featureConfig";

export default function AppFeatureProvider({children}: {children: ReactNode}) {
    const [backendAvailable, setBackendAvailable] = useState(false);
    const [hasAiKey, setHasAiKey] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const evaluate = () => {
            // Local vault readiness is synchronous; the backend probe is the
            // shared, cached /api/health request (no extra network call).
            if (!cancelled) setHasAiKey(resolveActiveProvider() !== null);
            void isBackendAvailable().then((available) => {
                if (!cancelled) setBackendAvailable(available);
            });
        };
        evaluate();
        window.addEventListener("topos:data-refresh", evaluate);
        return () => {
            cancelled = true;
            window.removeEventListener("topos:data-refresh", evaluate);
        };
    }, []);

    const context = useMemo<FeatureContext>(
        () => ({backendAvailable, hasAiKey}),
        [backendAvailable, hasAiKey],
    );

    return (
        <FeatureProvider registry={featureRegistry} context={context}>
            {children}
        </FeatureProvider>
    );
}

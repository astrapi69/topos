/**
 * pwa/lazy-route - deploy-safe React.lazy bound to Topos's storage namespace.
 *
 * The mechanism lives in @astrapi69/pwa-update-react; this binding pins the
 * namespace so the one-shot reload guard uses a stable key ("topos.*"). After
 * a GitHub Pages deploy the old index.html can reference chunk filenames that
 * no longer exist; a naive React.lazy then throws a ChunkLoadError and the
 * route renders blank. lazyWithReload catches that once and reloads to pull
 * the fresh index, then gives up if it still fails (so it never loops).
 */

import type {ComponentType} from "react";

import {lazyWithReload as kitLazyWithReload} from "@astrapi69/pwa-update-react";

/** React.lazy that survives a stale deploy with a single guarded reload. */
export function lazyWithReload<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the canonical React.lazy generic
    T extends ComponentType<any>,
>(factory: () => Promise<{default: T}>) {
    return kitLazyWithReload(factory, {storageNamespace: "topos"});
}

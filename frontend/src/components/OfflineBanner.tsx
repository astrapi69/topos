/**
 * Backend-availability banner.
 *
 * On a normal deployment the FastAPI backend answers GET /api/health and
 * the app runs in API mode (backend as source of truth, Dexie as the
 * read-through cache). On GitHub Pages there is no backend, so the probe
 * fails and the app runs in Dexie-only (offline) mode - we surface that
 * with a persistent banner so the user knows data stays on their device.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {isBackendAvailable} from "../utils/backendStatus";

export default function OfflineBanner() {
    const {t} = useI18n();
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        let cancelled = false;
        // Shares the single /api/health probe with the data hooks
        // (see utils/backendStatus) - no second health request.
        void isBackendAvailable().then((available) => {
            if (!cancelled) setOffline(!available);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!offline) return null;

    return (
        <div
            data-testid="offline-banner"
            role="status"
            className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-sm text-center"
        >
            {t("topos.offline.banner", "Offline-Modus - Daten werden nur lokal gespeichert.")}
        </div>
    );
}

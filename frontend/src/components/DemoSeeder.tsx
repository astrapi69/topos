/**
 * Seeds demo data into Dexie on first start in Dexie-only mode.
 *
 * When no backend answers (e.g. the GitHub Pages PWA) and the cache is
 * empty, this inserts a small realistic demo set so the app is not blank,
 * then fires ``topos:data-refresh`` so the already-mounted data hooks
 * re-read the cache, and shows an info toast. Renders nothing. Mounted
 * once inside the providers (needs i18n + the toast container).
 */

import {useEffect} from "react";

import {seedDemoDataIfEmpty} from "../db/seed";
import {rebuildSearchIndex} from "../search/buildIndex";
import {isBackendAvailable} from "../utils/backendStatus";
import {useI18n} from "../hooks/useI18n";
import {notify} from "../utils/notify";

export default function DemoSeeder() {
    const {t} = useI18n();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // A backend is present -> it fills the cache, no demo needed.
            if (await isBackendAvailable()) return;
            const seeded = await seedDemoDataIfEmpty();
            if (cancelled || !seeded) return;
            await rebuildSearchIndex();
            window.dispatchEvent(new CustomEvent("topos:data-refresh"));
            notify.info(
                t(
                    "topos.demo.seeded",
                    "Demo-Daten geladen. Verbinde ein Backend für echte Daten.",
                ),
            );
        })();
        return () => {
            cancelled = true;
        };
        // t only feeds the toast fallback; the seed must run exactly once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

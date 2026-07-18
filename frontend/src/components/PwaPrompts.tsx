/**
 * Non-intrusive PWA affordances:
 * - a bottom bar offering to activate a waiting service worker ("new
 *   version available" -> "update"), driven by vite-plugin-pwa's
 *   useRegisterSW (registerType: "prompt").
 * - a small "install app" button shown when the browser fires
 *   beforeinstallprompt.
 */

import {Download, RefreshCw} from "lucide-react";
import {useRegisterSW} from "virtual:pwa-register/react";

import {useI18n} from "../hooks/useI18n";
import {usePwaInstall} from "../pwa/usePwaInstall";
import {btnPrimary} from "../ui/classes";

export default function PwaPrompts() {
    const {t} = useI18n();
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW();
    const {canInstall, promptInstall} = usePwaInstall();

    return (
        <>
            {canInstall && (
                <button
                    type="button"
                    data-testid="pwa-install"
                    onClick={() => void promptInstall()}
                    className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-lg hover:bg-surface-hover cursor-pointer"
                >
                    <Download size={16} aria-hidden />
                    {t("pwa.install_app", "App installieren")}
                </button>
            )}

            {needRefresh && (
                <div
                    data-testid="pwa-update-bar"
                    role="status"
                    className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 shadow-lg"
                >
                    <span className="text-sm text-ink">
                        {t("pwa.update_available", "Neue Version verfügbar")}
                    </span>
                    <button
                        type="button"
                        data-testid="pwa-update-action"
                        onClick={() => void updateServiceWorker(true)}
                        className={btnPrimary}
                    >
                        <RefreshCw size={14} aria-hidden />
                        {t("pwa.update_action", "Aktualisieren")}
                    </button>
                </div>
            )}
        </>
    );
}

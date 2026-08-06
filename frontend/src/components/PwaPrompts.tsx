/**
 * PWA install affordance: a small "install app" button shown when the
 * browser fires beforeinstallprompt.
 *
 * The service-worker update prompt that used to live here (vite-plugin-pwa's
 * useRegisterSW) was replaced by @astrapi69/pwa-update's UpdateBanner, driven
 * by a version.json manifest (see AppUpdateProvider + pwa/update-store). This
 * component keeps only the install button, which the kit does not cover.
 */

import {Download} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import {usePwaInstall} from "../pwa/usePwaInstall";

export default function PwaPrompts() {
    const {t} = useI18n();
    const {canInstall, promptInstall} = usePwaInstall();

    if (!canInstall) return null;

    return (
        <button
            type="button"
            data-testid="pwa-install"
            onClick={() => void promptInstall()}
            className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-lg hover:bg-surface-hover cursor-pointer"
        >
            <Download size={16} aria-hidden />
            {t("pwa.install_app", "App installieren")}
        </button>
    );
}

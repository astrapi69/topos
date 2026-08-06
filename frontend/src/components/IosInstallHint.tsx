/**
 * IosInstallHint - the iOS counterpart to the Android install affordance.
 *
 * iOS Safari fires no `beforeinstallprompt`, so `usePwaInstall` never yields a
 * prompt there and the About-section install link never appears. Instead we
 * surface a short, dismissable "Share -> Add to Home Screen" instruction, but
 * ONLY on iOS Safari and ONLY before the app is installed - it is never shown
 * where it cannot apply.
 *
 * Bottom-anchored, dismissable once (persisted in localStorage). Client-only
 * and storage-mode-agnostic: it reads nothing but the platform + a flag, so it
 * works identically on the backend build and the offline GH-Pages build.
 * Ported from adaptive-learner (src/components/pwa/IosInstallHint.tsx).
 */

import {useState} from "react";
import {Share, X} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import {isStandalone, shouldShowIosInstallHint} from "../pwa/iosInstall";

const STORAGE_KEY = "topos.ios_install_dismissed";

function readDismissed(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeDismissed(): void {
    try {
        localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        /* private mode: non-load-bearing flag, ignore */
    }
}

/** Resolve initial visibility from the real platform + dismissal state. */
function computeInitialVisible(): boolean {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {maxTouchPoints?: number};
    return shouldShowIosInstallHint({
        userAgent: nav.userAgent ?? "",
        platform: nav.platform ?? "",
        maxTouchPoints: nav.maxTouchPoints ?? 0,
        standalone: isStandalone(),
        dismissed: readDismissed(),
    });
}

export default function IosInstallHint() {
    const {t} = useI18n();
    const [visible, setVisible] = useState<boolean>(computeInitialVisible);

    if (!visible) return null;

    const dismiss = () => {
        writeDismissed();
        setVisible(false);
    };

    return (
        <div
            className={
                "fixed inset-x-0 bottom-0 z-[9998] flex items-start gap-3 " +
                "border-t border-line bg-surface p-3 text-sm shadow-lg " +
                "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            }
            role="region"
            aria-label={t("pwa.ios.aria_label", "Auf dem iPhone installieren")}
            data-testid="ios-install-hint"
        >
            <Share size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <strong className="block text-ink">
                    {t("pwa.ios.title", "Als App installieren")}
                </strong>
                <span className="text-ink-muted">
                    {t(
                        "pwa.ios.steps",
                        "Tippe auf das Teilen-Symbol und dann auf Zum Home-Bildschirm - Topos öffnet dann ohne Safari-Leiste.",
                    )}
                </span>
            </div>
            <button
                type="button"
                onClick={dismiss}
                aria-label={t("pwa.ios.dismiss", "Ausblenden")}
                className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
                data-testid="ios-install-hint-dismiss"
            >
                <X size={18} aria-hidden="true" />
            </button>
        </div>
    );
}

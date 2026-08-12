/**
 * InstallBanner - the top-level install affordance for every platform that
 * fires `beforeinstallprompt` (Android Chrome, desktop Chromium).
 *
 * Its counterpart IosInstallHint covers iOS Safari, which fires no such
 * event. Before this banner the two were asymmetric: iOS got a global
 * hint, everyone else had the install button buried in
 * Settings > About - the one screen nobody opens looking to install.
 * The About button stays as the deliberate second place, for anyone who
 * dismissed this banner.
 *
 * Only ever rendered when the browser itself says installing is possible,
 * so it cannot appear in an installed window or where it would not work.
 * Dismissal persists (localStorage), because a nag that returns on every
 * load is worse than no prompt at all.
 */

import { useState } from "react";
import { Download, X } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { usePwaInstall } from "../pwa/usePwaInstall";
import { btnPrimary, iconButton } from "../ui/classes";

const STORAGE_KEY = "topos.install_dismissed";

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

export default function InstallBanner() {
  const { t } = useI18n();
  const { canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  if (!canInstall || dismissed) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <div
      className={
        "fixed inset-x-0 bottom-0 z-[9998] flex items-center gap-3 " +
        "border-t border-line bg-surface p-3 text-sm shadow-lg " +
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      }
      role="region"
      aria-label={t("pwa.install.aria_label", "Topos als App installieren")}
      data-testid="install-banner"
    >
      <Download size={20} className="shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className="block text-ink">
          {t("pwa.install.title", "Als App installieren")}
        </strong>
        <span className="text-ink-muted">
          {t(
            "pwa.install.subtitle",
            "Topos startet dann im eigenen Fenster und funktioniert offline.",
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void promptInstall()}
        className={`${btnPrimary} shrink-0`}
        data-testid="install-banner-action"
      >
        {t("pwa.install_app", "App installieren")}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("pwa.install.dismiss", "Ausblenden")}
        className={`${iconButton} shrink-0`}
        data-testid="install-banner-dismiss"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * AppUpdateProvider - app glue between Topos's i18n, the Topos button slot,
 * and @astrapi69/pwa-update-react.
 *
 * The kit's messages are resolved here from Topos i18n keys with German
 * fallbacks (Topos's primary language). On GitHub Pages there is no backend
 * catalog, so `t` returns the fallbacks - which is why the fallbacks are the
 * real German copy, not English. Reuses the existing `pwa.*` keys where they
 * already exist. No key migration needed. Mirrors the ai-key-vault provider
 * wiring.
 */

import { useMemo, type ReactNode } from "react";

import {
  PwaUpdateProvider,
  type UpdateMessages,
} from "@astrapi69/pwa-update-react";

import { useI18n } from "../hooks/useI18n";
import { appUpdateStore } from "../pwa/update-store";
import { ToposUpdateButton } from "../pwa/pwaSlots";

/** Resolve the kit's message object from Topos i18n (German fallbacks). */
function buildMessages(
  t: (key: string, fallback?: string) => string,
): UpdateMessages {
  return {
    bannerMessage: t("pwa.update_available", "Neue Version verfügbar"),
    apply: t("pwa.update_action", "Aktualisieren"),
    later: t("pwa.update_later", "Später"),
    fullRestartHint: t(
      "pwa.update_restart_hint",
      "Wenn sich nichts ändert, App schließen und neu öffnen.",
    ),
    checkForUpdates: t("pwa.check_update", "Nach Updates suchen"),
    checking: t("pwa.checking", "Prüfe…"),
    updateAvailable: t(
      "pwa.update_available_version",
      "Version {version} ist verfügbar!",
    ),
    updatePreparing: t(
      "pwa.update_preparing",
      "Ein neuer Build wird vorbereitet. Gleich erneut prüfen.",
    ),
    upToDate: t("pwa.up_to_date", "Du nutzt die neueste Version."),
    checkFailed: t(
      "pwa.check_failed",
      "Prüfung fehlgeschlagen. Bist du online?",
    ),
    lastChecked: t("pwa.last_checked", "Zuletzt geprüft: {when}"),
    neverChecked: t("pwa.never_checked", "Noch nie geprüft"),
    versionHeading: t("pwa.version_heading", "Version"),
    versionLabel: t("pwa.version_label", "Topos"),
    buildLabel: t("pwa.build_label", "Build"),
    buildDateLabel: t("pwa.build_date_label", "Build-Datum"),
  };
}

export default function AppUpdateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  // Memoised on `t` (not `lang`): the i18n catalog loads async from the
  // backend, changing `t`'s identity without changing `lang`. A `[lang]`
  // memo would freeze the messages on the first-paint fallbacks. `t` is a
  // stable callback keyed on the loaded catalog + language, so this only
  // rebuilds when the strings actually change.
  const messages = useMemo(() => buildMessages(t), [t]);
  return (
    <PwaUpdateProvider
      store={appUpdateStore}
      messages={messages}
      Button={ToposUpdateButton}
      locale={lang}
    >
      {children}
    </PwaUpdateProvider>
  );
}

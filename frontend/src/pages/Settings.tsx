/**
 * Settings, organised as tabs behind a left sidebar (adaptive-learner
 * pattern): the page had grown into one long scroll of unrelated
 * sections, so each now lives on its own tab.
 *
 * The tab list is ONE shared model (settings/sidebarModel) rendered by
 * two surfaces - {@link SettingsSidebar} from `md` up, {@link
 * SettingsMobileMenu} below it - which a parity test keeps in step. The
 * active tab lives in `?tab=`, so a panel can be linked and survives a
 * reload; an unknown value falls back to the first tab.
 *
 * Tabs that need something unavailable are absent rather than greyed
 * out: the application-key tab only exists when a backend reports one.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import NavBar from "../components/NavBar";
import AboutSection from "../components/AboutSection";
import AiProviderSettings from "../components/AiProviderSettings";
import DataSection from "../components/DataSection";
import BackendUrlSettings from "../components/BackendUrlSettings";
import OrphanPathsSection from "../components/OrphanPathsSection";
import ThemePicker from "../components/ThemePicker";
import SettingsSidebar from "../components/settings/SettingsSidebar";
import SettingsMobileMenu from "../components/settings/SettingsMobileMenu";
import { resolveTab, type SidebarGroup } from "../settings/sidebarModel";
import { api, type SecretSource } from "../api/client";
import { db } from "../db/schema";
import { refreshAll } from "../hooks/useTopos";
import { useI18n } from "../hooks/useI18n";
import { useDialog } from "../components/AppDialog";
import { isBackendAvailable } from "../utils/backendStatus";
import { notify, errorMessage } from "../utils/notify";
import { btn, input, muted, pageMain } from "../ui/classes";

const LANGUAGES = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"];

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { confirm } = useDialog();
  const [resetting, setResetting] = useState(false);
  const [secretSource, setSecretSource] = useState<SecretSource | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const groups: SidebarGroup[] = useMemo(
    () => [
      {
        key: "app",
        label: t("topos.page.settings.group_app", "App"),
        items: [
          {
            value: "general",
            label: t("topos.page.settings.tab_general", "Allgemein"),
            testId: "settings-tab-general",
          },
          {
            value: "ai",
            label: t("topos.page.settings.tab_ai", "KI-Assistent"),
            testId: "settings-tab-ai",
          },
          {
            value: "backend",
            label: t("topos.page.settings.tab_backend", "Backend"),
            testId: "settings-tab-backend",
          },
        ],
      },
      {
        key: "data",
        label: t("topos.page.settings.group_data", "Daten"),
        items: [
          {
            value: "data",
            label: t("topos.page.settings.tab_data", "Import & Export"),
            testId: "settings-tab-data",
          },
          {
            value: "maintenance",
            label: t("topos.page.settings.tab_maintenance", "Wartung"),
            testId: "settings-tab-maintenance",
          },
        ],
      },
      {
        key: "system",
        label: t("topos.page.settings.group_system", "System"),
        items: [
          // Absent rather than disabled when no backend reports a key.
          ...(secretSource
            ? [
                {
                  value: "security",
                  label: t(
                    "topos.page.settings.tab_security",
                    "Anwendungsschlüssel",
                  ),
                  testId: "settings-tab-security",
                },
              ]
            : []),
          {
            value: "about",
            label: t("topos.page.settings.tab_about", "Über Topos"),
            testId: "settings-tab-about",
          },
        ],
      },
    ],
    [t, secretSource],
  );

  const tab = resolveTab(groups, searchParams.get("tab"));

  function selectTab(next: string) {
    // replace: tab switching is not history the back button should walk.
    setSearchParams({ tab: next }, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Skip the request entirely in offline mode (no backend to answer).
      if (!(await isBackendAvailable())) return;
      try {
        const src = await api.settings.getSecretSource();
        if (!cancelled) setSecretSource(src);
      } catch {
        /* Transient failure - hide the card. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResetCache() {
    const ok = await confirm(
      t("topos.confirm.reset_cache_title", "Cache zurücksetzen?"),
      t(
        "topos.confirm.reset_cache_message",
        "Der lokale Cache wird geleert und die Daten werden neu vom Server geladen.",
      ),
      "danger",
      {
        confirmLabel: t("topos.page.settings.reset", "Cache zurücksetzen"),
        cancelLabel: t("topos.common.cancel", "Abbrechen"),
      },
    );
    if (!ok) return;
    setResetting(true);
    try {
      await Promise.all([
        db.containers.clear(),
        db.items.clear(),
        db.categories.clear(),
        db.actions.clear(),
      ]);
      await refreshAll();
      notify.success(t("topos.toast.cache_cleared", "Lokaler Cache geleert"));
    } catch (e) {
      notify.error(
        errorMessage(
          e,
          t(
            "topos.toast.cache_clear_failed",
            "Cache konnte nicht geleert werden",
          ),
        ),
        e,
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className={pageMain}>
        <h1 data-testid="settings-title">
          {t("topos.page.settings.title", "Einstellungen")}
        </h1>

        <SettingsMobileMenu
          groups={groups}
          activeTab={tab}
          onChange={selectTab}
        />

        <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6">
          <SettingsSidebar
            groups={groups}
            activeTab={tab}
            onChange={selectTab}
          />

          <div data-testid="settings-panel" className="min-w-0">
            {tab === "general" && (
              <>
                <section style={{ marginBottom: "1.5rem" }}>
                  <h2>{t("topos.page.settings.language", "Sprache")}</h2>
                  <select
                    className={input}
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    aria-label={t("topos.page.settings.language", "Sprache")}
                    data-testid="settings-language-select"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </section>

                <section>
                  <h2>{t("topos.page.settings.theme", "Erscheinungsbild")}</h2>
                  <ThemePicker />
                </section>
              </>
            )}

            {tab === "ai" && <AiProviderSettings />}

            {tab === "backend" && <BackendUrlSettings />}

            {tab === "data" && <DataSection />}

            {tab === "maintenance" && (
              <>
                <OrphanPathsSection />

                <section>
                  <h2>{t("topos.page.settings.cache", "Lokaler Cache")}</h2>
                  <p className={muted}>
                    {t(
                      "topos.page.settings.cache_description",
                      "Leert den IndexedDB-Cache und holt die Daten neu vom Server.",
                    )}
                  </p>
                  <button
                    type="button"
                    className={btn}
                    onClick={handleResetCache}
                    disabled={resetting}
                    data-testid="settings-reset-cache"
                  >
                    {resetting
                      ? t(
                          "topos.page.settings.resetting",
                          "Wird zurückgesetzt...",
                        )
                      : t("topos.page.settings.reset", "Cache zurücksetzen")}
                  </button>
                </section>
              </>
            )}

            {tab === "security" && secretSource && (
              <section>
                <h2>
                  {t("topos.page.settings.secret_key", "Anwendungsschlüssel")}
                </h2>
                <p data-testid="settings-secret-source-label">
                  {t(
                    `topos.page.settings.secret_key_source_${secretSource.source}`,
                    `Key from: ${secretSource.source}`,
                  )}
                </p>
                {(secretSource.source === "secrets_yaml" ||
                  secretSource.source === "env") && (
                  <p
                    data-testid="settings-secret-source-hint"
                    className={muted}
                    style={{ fontSize: "0.875rem" }}
                  >
                    {t(
                      "topos.page.settings.secret_key_external_hint",
                      "Dieser Schlüssel wird in {path} konfiguriert. Bearbeiten Sie die Datei, um ihn zu ändern.",
                    ).replace(
                      "{path}",
                      secretSource.source === "env"
                        ? `$${secretSource.envVar}`
                        : (secretSource.path ?? secretSource.secretsYamlPath),
                    )}
                  </p>
                )}
              </section>
            )}

            {tab === "about" && <AboutSection />}
          </div>
        </div>
      </main>
    </>
  );
}

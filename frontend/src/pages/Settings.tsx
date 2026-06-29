/**
 * Settings: language + theme toggles plus the Topos data-export /
 * cache-reset row. The page intentionally stays compact; Phase 6
 * ships the must-have toggles, deeper settings will arrive in a
 * later iteration.
 */

import {useEffect, useState} from "react";

import NavBar from "../components/NavBar";
import {api, type SecretSource} from "../api/client";
import {db} from "../db/schema";
import {refreshAll} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";
import {useDialog} from "../components/AppDialog";
import {notify, errorMessage} from "../utils/notify";

const LANGUAGES = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"];

export default function Settings() {
    const {t, lang, setLang} = useI18n();
    const {theme, toggle} = useTheme();
    const {confirm} = useDialog();
    const [resetting, setResetting] = useState(false);
    const [secretSource, setSecretSource] = useState<SecretSource | null>(null);

    useEffect(() => {
        let cancelled = false;
        api.settings
            .getSecretSource()
            .then((src) => {
                if (!cancelled) setSecretSource(src);
            })
            .catch(() => {
                /* PWA mode (no backend) or transient failure - hide the card. */
            });
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
                errorMessage(e, t("topos.toast.cache_clear_failed", "Cache konnte nicht geleert werden")),
                e,
            );
        } finally {
            setResetting(false);
        }
    }

    return (
        <>
            <NavBar />
            <main style={{padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: 720}}>
                <h1 data-testid="settings-title">
                    {t("topos.page.settings.title", "Einstellungen")}
                </h1>

                <section style={{marginBottom: "1.5rem"}}>
                    <h2>{t("topos.page.settings.language", "Sprache")}</h2>
                    <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        data-testid="settings-language-select"
                    >
                        {LANGUAGES.map((l) => (
                            <option key={l} value={l}>
                                {l.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </section>

                <section style={{marginBottom: "1.5rem"}}>
                    <h2>{t("topos.page.settings.theme", "Erscheinungsbild")}</h2>
                    <button
                        type="button"
                        onClick={toggle}
                        data-testid="settings-theme-toggle"
                    >
                        {t("topos.page.settings.theme_current", "Theme")}: {theme}
                    </button>
                </section>

                {secretSource && (
                    <section style={{marginBottom: "1.5rem"}}>
                        <h2>{t("topos.page.settings.secret_key", "Anwendungsschlüssel")}</h2>
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
                                style={{color: "#666", fontSize: "0.875rem"}}
                            >
                                {t(
                                    "topos.page.settings.secret_key_external_hint",
                                    "Dieser Schlüssel wird in {path} konfiguriert. Bearbeiten Sie die Datei, um ihn zu ändern.",
                                ).replace(
                                    "{path}",
                                    secretSource.source === "env"
                                        ? `$${secretSource.envVar}`
                                        : secretSource.path ?? secretSource.secretsYamlPath,
                                )}
                            </p>
                        )}
                    </section>
                )}

                <section>
                    <h2>{t("topos.page.settings.cache", "Lokaler Cache")}</h2>
                    <p style={{color: "#666"}}>
                        {t(
                            "topos.page.settings.cache_description",
                            "Leert den IndexedDB-Cache und holt die Daten neu vom Server.",
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={handleResetCache}
                        disabled={resetting}
                        data-testid="settings-reset-cache"
                    >
                        {resetting
                            ? t("topos.page.settings.resetting", "Wird zurückgesetzt...")
                            : t("topos.page.settings.reset", "Cache zurücksetzen")}
                    </button>
                </section>
            </main>
        </>
    );
}

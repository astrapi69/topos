/**
 * Settings: language + theme toggles plus the Topos data-export /
 * cache-reset row. The page intentionally stays compact; Phase 6
 * ships the must-have toggles, deeper settings will arrive in a
 * later iteration.
 */

import {useState} from "react";

import NavBar from "../components/NavBar";
import {db} from "../db/schema";
import {refreshAll} from "../hooks/useTopos";
import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";

const LANGUAGES = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"];

export default function Settings() {
    const {t, lang, setLang} = useI18n();
    const {theme, toggle} = useTheme();
    const [resetting, setResetting] = useState(false);
    const [resetStatus, setResetStatus] = useState<string | null>(null);

    async function handleResetCache() {
        setResetting(true);
        setResetStatus(null);
        try {
            await Promise.all([
                db.containers.clear(),
                db.items.clear(),
                db.categories.clear(),
                db.actions.clear(),
            ]);
            await refreshAll();
            setResetStatus(t("topos.page.settings.reset_ok", "Cache zurückgesetzt."));
        } catch (e) {
            setResetStatus(String(e));
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
                    {resetStatus && (
                        <p data-testid="settings-reset-status" style={{marginTop: "0.5rem"}}>
                            {resetStatus}
                        </p>
                    )}
                </section>
            </main>
        </>
    );
}

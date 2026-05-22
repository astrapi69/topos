import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";

/**
 * Phase 3 placeholder. Phase 6 of the bootstrap rebuilds the
 * Settings page with the full Topos settings UI (language picker,
 * theme picker, data export, reset DB, plugin status). For now,
 * just renders the title and a toggle for the light/dark theme so
 * the keep-the-frontend-building contract is satisfied.
 */
export default function Settings() {
    const {t} = useI18n();
    const {theme, toggle} = useTheme();

    return (
        <main>
            <h1>{t("topos.app.name", "Topos")} - Settings</h1>
            <button
                type="button"
                onClick={toggle}
                data-testid="settings-theme-toggle"
            >
                Theme: {theme}
            </button>
        </main>
    );
}

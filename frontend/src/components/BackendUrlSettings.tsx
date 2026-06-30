/**
 * Settings section to point the app at a backend running elsewhere
 * (VPS, home server). The URL is stored in localStorage (it configures
 * the API layer, not app data). "Test connection" probes
 * ``{url}/api/health``; on success it saves the URL, resets the backend
 * probe, drops the demo data, and fires ``topos:data-refresh`` so the
 * offline banner hides and the data hooks load from the real backend.
 */

import {useState} from "react";

import {apiBase, getBackendUrl, setBackendUrl} from "../api/baseUrl";
import {_resetBackendProbe} from "../utils/backendStatus";
import {clearDemoData} from "../db/seed";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {btnPrimary, input, muted} from "../ui/classes";

const TEST_TIMEOUT_MS = 5000;

export default function BackendUrlSettings() {
    const {t} = useI18n();
    const [url, setUrl] = useState(getBackendUrl());
    const [saved, setSaved] = useState(getBackendUrl());
    const [testing, setTesting] = useState(false);

    async function probe(target: string): Promise<boolean> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
        try {
            const res = await fetch(`${apiBase(target)}/health`, {signal: controller.signal});
            return res.ok;
        } finally {
            clearTimeout(timer);
        }
    }

    async function handleTest() {
        setTesting(true);
        const target = url.trim();
        try {
            const ok = await probe(target);
            if (!ok) {
                notify.error(
                    t("topos.page.settings.backend_unreachable", "Backend nicht erreichbar."),
                );
                return;
            }
            // Connected: persist, reset the cached probe, drop demo data,
            // and let the hooks + banner re-evaluate against the backend.
            setBackendUrl(target);
            setSaved(target);
            _resetBackendProbe();
            await clearDemoData();
            window.dispatchEvent(new CustomEvent("topos:data-refresh"));
            notify.success(
                t("topos.page.settings.backend_connected", "Verbunden. Daten werden vom Backend geladen."),
            );
        } catch (e) {
            notify.error(
                errorMessage(
                    e,
                    t("topos.page.settings.backend_unreachable", "Backend nicht erreichbar."),
                ),
                e,
            );
        } finally {
            setTesting(false);
        }
    }

    return (
        <section style={{marginBottom: "1.5rem"}} data-testid="backend-url-section">
            <h2>{t("topos.page.settings.backend_title", "Backend-Verbindung")}</h2>
            <p className={muted}>
                {t(
                    "topos.page.settings.backend_description",
                    "Standardmäßig nutzt die App ein Backend auf demselben Host. Läuft dein Backend woanders, trage hier seine Adresse ein.",
                )}
            </p>
            <div className="flex flex-col gap-2 max-w-md">
                <label className="flex flex-col gap-1">
                    {t("topos.page.settings.backend_url_label", "Backend-URL")}
                    <input
                        className={input}
                        type="url"
                        inputMode="url"
                        placeholder="http://localhost:8010"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        data-testid="backend-url-input"
                    />
                </label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className={btnPrimary}
                        onClick={handleTest}
                        disabled={testing}
                        data-testid="backend-url-test"
                    >
                        {testing
                            ? t("topos.page.settings.backend_testing", "Teste...")
                            : t("topos.page.settings.backend_test", "Verbindung testen")}
                    </button>
                </div>
                <p className={`${muted} text-sm`} data-testid="backend-url-current">
                    {saved
                        ? t("topos.page.settings.backend_current", "Aktuell verbunden: {url}").replace(
                              "{url}",
                              saved,
                          )
                        : t("topos.page.settings.backend_same_origin", "Aktuell: gleicher Host (/api)")}
                </p>
            </div>
        </section>
    );
}

/**
 * AI provider settings: pick a provider, choose a (vision-capable)
 * model, store an API key, and test the connection.
 *
 * Keys are never read back from the server - the input is write-only.
 * When a provider's key is managed via env var or secrets.yaml the
 * input is replaced by a read-only source card (the same pattern as the
 * application secret key), and the backend strips such keys from any
 * PATCH defensively.
 *
 * The whole section hides itself when the AI settings endpoints are not
 * reachable (PWA / offline mode with no backend).
 */

import {useEffect, useState} from "react";

import {
    api,
    type AiConfig,
    type AiKeyStatus,
    type AiProvider,
} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {btn, btnPrimary, input, muted, badge, danger} from "../ui/classes";

function statusByProvider(statuses: AiKeyStatus[]): Record<string, AiKeyStatus> {
    return Object.fromEntries(statuses.map((s) => [s.provider, s]));
}

export default function AiProviderSettings() {
    const {t} = useI18n();
    const [loaded, setLoaded] = useState(false);
    const [available, setAvailable] = useState(false);
    const [providers, setProviders] = useState<AiProvider[]>([]);
    const [keyStatus, setKeyStatus] = useState<Record<string, AiKeyStatus>>({});
    const [enabled, setEnabled] = useState(false);
    const [activeProvider, setActiveProvider] = useState("anthropic");
    const [models, setModels] = useState<Record<string, string>>({});
    const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
    const [apiKey, setApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api.settings.getAiProviders(),
            api.settings.getAiKeyStatus(),
            api.settings.getApp(),
        ])
            .then(([provs, statuses, appCfg]) => {
                if (cancelled) return;
                const ai = appCfg.ai ?? {};
                setProviders(provs);
                setKeyStatus(statusByProvider(statuses));
                setEnabled(Boolean(ai.enabled));
                setActiveProvider(ai.activeProvider || "anthropic");
                setModels(ai.models ?? {});
                setBaseUrls(ai.baseUrls ?? {});
                setAvailable(true);
                setLoaded(true);
            })
            .catch(() => {
                // No backend (PWA/offline) or transient failure: hide the section.
                if (!cancelled) {
                    setAvailable(false);
                    setLoaded(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!loaded || !available) return null;

    const provider = providers.find((p) => p.id === activeProvider) ?? providers[0];
    const status = keyStatus[activeProvider];
    const externallyManaged = status?.externallyManaged ?? false;
    const configured = status?.configured ?? false;
    const selectedModel = models[activeProvider] ?? provider?.defaultModel ?? "";

    function onProviderChange(id: string) {
        setActiveProvider(id);
        setApiKey(""); // never carry a typed key across providers
    }

    function onModelChange(model: string) {
        setModels((prev) => ({...prev, [activeProvider]: model}));
    }

    function onBaseUrlChange(url: string) {
        setBaseUrls((prev) => ({...prev, [activeProvider]: url}));
    }

    async function refreshKeyStatus() {
        const statuses = await api.settings.getAiKeyStatus();
        setKeyStatus(statusByProvider(statuses));
    }

    async function handleSave() {
        setSaving(true);
        const patch: AiConfig = {enabled, activeProvider, models, baseUrls};
        if (apiKey.trim() && !externallyManaged) {
            patch.keys = {[activeProvider]: apiKey.trim()};
        }
        try {
            await api.settings.updateApp({ai: patch});
            await refreshKeyStatus();
            setApiKey("");
            notify.success(
                t("topos.page.settings.ai.saved", "AI-Einstellungen gespeichert"),
            );
        } catch (e) {
            notify.error(
                errorMessage(
                    e,
                    t("topos.page.settings.ai.save_failed", "Speichern fehlgeschlagen"),
                ),
                e,
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        setTesting(true);
        try {
            const result = await api.settings.testAiConnection({
                provider: activeProvider,
                apiKey: apiKey.trim() || undefined,
                baseUrl: baseUrls[activeProvider] || undefined,
            });
            if (result.ok) {
                notify.success(
                    t("topos.page.settings.ai.test_ok", "Verbindung erfolgreich"),
                );
            } else {
                const code = result.errorCode || "unknown";
                notify.error(
                    t(
                        `topos.page.settings.ai.test_err_${code}`,
                        t(
                            "topos.page.settings.ai.test_failed",
                            "Verbindung fehlgeschlagen",
                        ),
                    ),
                );
            }
        } catch (e) {
            notify.error(
                errorMessage(
                    e,
                    t("topos.page.settings.ai.test_failed", "Test fehlgeschlagen"),
                ),
                e,
            );
        } finally {
            setTesting(false);
        }
    }

    const visionLabel = t("topos.page.settings.ai.vision_badge", "Vision");
    const sourceLabel = t(
        `topos.page.settings.secret_key_source_${status?.source ?? "none"}`,
        `Key from: ${status?.source ?? "none"}`,
    );

    return (
        <section style={{marginBottom: "1.5rem"}} data-testid="ai-settings-section">
            <h2>{t("topos.page.settings.ai.title", "KI-Assistent")}</h2>
            <p className={muted}>
                {t(
                    "topos.page.settings.ai.description",
                    "Anbieter, API-Schluessel und Modell fuer die Bilderkennung von Box-Inhalten.",
                )}
            </p>

            <label
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    margin: "0.75rem 0",
                }}
            >
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    data-testid="ai-enable-toggle"
                    style={{width: 20, height: 20}}
                />
                {t("topos.page.settings.ai.enable", "KI-Funktionen aktivieren")}
            </label>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    maxWidth: 420,
                }}
            >
                <label style={{display: "flex", flexDirection: "column", gap: "0.25rem"}}>
                    {t("topos.page.settings.ai.provider", "Anbieter")}
                    <select
                        className={input}
                        value={activeProvider}
                        onChange={(e) => onProviderChange(e.target.value)}
                        data-testid="ai-provider-select"
                    >
                        {providers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>

                {provider?.requiresBaseUrl && (
                    <label style={{display: "flex", flexDirection: "column", gap: "0.25rem"}}>
                        {t("topos.page.settings.ai.base_url", "Basis-URL")}
                        <input
                            className={input}
                            type="url"
                            placeholder="http://localhost:11434/v1"
                            value={baseUrls[activeProvider] ?? ""}
                            onChange={(e) => onBaseUrlChange(e.target.value)}
                            data-testid="ai-base-url-input"
                        />
                    </label>
                )}

                <label style={{display: "flex", flexDirection: "column", gap: "0.25rem"}}>
                    {t("topos.page.settings.ai.model", "Modell")}
                    {provider && provider.models.length > 0 ? (
                        <select
                            className={input}
                            value={selectedModel}
                            onChange={(e) => onModelChange(e.target.value)}
                            data-testid="ai-model-select"
                        >
                            {provider.models.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.label}
                                    {m.vision ? ` - ${visionLabel}` : ""}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            className={input}
                            type="text"
                            value={selectedModel}
                            onChange={(e) => onModelChange(e.target.value)}
                            data-testid="ai-model-input"
                        />
                    )}
                </label>

                {externallyManaged ? (
                    <p className={muted} data-testid="ai-key-source">
                        {sourceLabel}
                    </p>
                ) : (
                    <label style={{display: "flex", flexDirection: "column", gap: "0.25rem"}}>
                        {t("topos.page.settings.ai.api_key", "API-Schluessel")}
                        <input
                            className={input}
                            type="password"
                            autoComplete="off"
                            placeholder={
                                configured
                                    ? t("topos.page.settings.ai.key_set", "Gespeichert")
                                    : t(
                                          "topos.page.settings.ai.key_placeholder",
                                          "API-Schluessel eingeben",
                                      )
                            }
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            data-testid="ai-key-input"
                        />
                        {configured && (
                            <span className={badge} data-testid="ai-key-configured">
                                {t(
                                    "topos.page.settings.ai.configured",
                                    "Schluessel gespeichert",
                                )}
                            </span>
                        )}
                    </label>
                )}

                <div style={{display: "flex", gap: "0.5rem"}}>
                    <button
                        type="button"
                        className={btnPrimary}
                        onClick={handleSave}
                        disabled={saving}
                        data-testid="ai-save-button"
                    >
                        {saving
                            ? t("topos.page.settings.ai.saving", "Speichern...")
                            : t("topos.page.settings.ai.save", "Speichern")}
                    </button>
                    <button
                        type="button"
                        className={btn}
                        onClick={handleTest}
                        disabled={testing}
                        data-testid="ai-test-button"
                    >
                        {testing
                            ? t("topos.page.settings.ai.testing", "Teste...")
                            : t("topos.page.settings.ai.test", "Verbindung testen")}
                    </button>
                </div>
                {provider?.note === "vision_depends_on_model" && (
                    <p className={danger} style={{fontSize: "0.8125rem"}}>
                        {t(
                            "topos.page.settings.ai.custom_vision_hint",
                            "Vision-Unterstuetzung haengt vom gewaehlten Modell ab.",
                        )}
                    </p>
                )}
            </div>
        </section>
    );
}

/**
 * Base-URL field for the custom (OpenAI-compatible / self-hosted) provider.
 *
 * The ai-key-vault-react 0.1.x panel has no base-URL input, so Topos supplies
 * one: it renders only when ``custom`` is the active provider and writes the
 * value through the adapter's ``baseUrlOverride`` (the same sink the kit uses
 * for model overrides). Lives inside ``AiSettingsProvider`` so it can read the
 * active provider from ``useApiKeyStatus`` and the adapter from context.
 */

import {useEffect, useState} from "react";

import {
    refreshApiKeyStatus,
    useAiSettingsContext,
    useApiKeyStatus,
} from "@astrapi69/ai-key-vault-react";

import type {ToposProviderId} from "./registry";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {btn, input, muted} from "../ui/classes";

export default function CustomEndpointField() {
    const {t} = useI18n();
    const {adapter, registry, userId} = useAiSettingsContext<ToposProviderId>();
    const {activeProvider} = useApiKeyStatus();
    const [baseUrl, setBaseUrl] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);

    const isCustom = activeProvider === "custom";

    useEffect(() => {
        if (!isCustom || !userId) return;
        let cancelled = false;
        adapter
            .getSettings(userId)
            .then((snap) => {
                if (cancelled) return;
                setBaseUrl(snap.baseUrlOverride?.custom ?? "");
                setLoaded(true);
            })
            .catch(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [isCustom, userId, adapter]);

    if (!isCustom) return null;

    async function save() {
        if (!userId) return;
        setBusy(true);
        try {
            await adapter.patchSettings(userId, {
                baseUrlOverride: {custom: baseUrl.trim() || null},
            });
            await refreshApiKeyStatus(adapter, registry, userId);
            notify.success(
                t("topos.page.settings.ai.saved", "KI-Einstellungen gespeichert"),
            );
        } catch (err) {
            notify.error(
                errorMessage(
                    err,
                    t("topos.page.settings.ai.save_failed", "Speichern fehlgeschlagen"),
                ),
                err,
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                maxWidth: 420,
                marginTop: "0.75rem",
            }}
            data-testid="ai-custom-endpoint"
        >
            <label style={{display: "flex", flexDirection: "column", gap: "0.25rem"}}>
                {t("topos.page.settings.ai.base_url", "Basis-URL")}
                <input
                    className={input}
                    type="url"
                    placeholder="http://localhost:1234/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    data-testid="ai-custom-base-url"
                />
            </label>
            <p className={muted} style={{fontSize: "0.8125rem"}}>
                {t(
                    "topos.page.settings.ai.custom_base_url_hint",
                    "Endpunkt-URL des OpenAI-kompatiblen Servers (z. B. LM Studio, Ollama).",
                )}
            </p>
            <button
                type="button"
                className={btn}
                onClick={save}
                disabled={busy || !loaded}
                data-testid="ai-custom-base-url-save"
            >
                {t("topos.page.settings.ai.save", "Speichern")}
            </button>
        </div>
    );
}

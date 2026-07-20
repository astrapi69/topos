/**
 * AI provider settings, built on ``@astrapi69/ai-key-vault-react``.
 *
 * Two modes, same as before, now driven by the kit's ``AiSettingsPanel``:
 *
 * - **Backend mode** (a backend answers): keys live in the server config
 *   chain (env / ``secrets.yaml`` / ``app.yaml`` overlay), write-only from the
 *   client. The ``backendAdapter`` maps the panel onto ``/api/settings/*``.
 *   No encrypted key vault here - ``secrets.yaml`` is the backup.
 * - **Local mode** (no backend: GitHub Pages PWA / Dexie-only): keys live in
 *   a passphrase-encrypted vault in this browser. The section renders an
 *   unlock / create-passphrase gate; once unlocked, the same panel plus the
 *   encrypted ``.alk`` key-vault export/import (for moving keys between
 *   devices) are shown.
 *
 * The ``enabled`` flag is a Topos concept the kit has no notion of, so it
 * stays a wrapper-level toggle (persisted to the backend ``ai.enabled`` or the
 * local vault metadata).
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {
    AiSettingsPanel,
    AiSettingsProvider,
    KeyVaultSection,
    type ConfirmFn,
    type NotifyApi,
} from "@astrapi69/ai-key-vault-react";
import {emitSettingsRefresh} from "@astrapi69/ai-key-vault";
import {VaultDecryptError} from "@astrapi69/passphrase-vault";

import {api} from "../api/client";
import {createBackendAdapter} from "../ai/backendAdapter";
import {createLocalVaultAdapter} from "../ai/localVaultAdapter";
import CustomEndpointField from "../ai/CustomEndpointField";
import {TOPOS_REGISTRY} from "../ai/registry";
import {ToposButton, ToposInput, ToposLink} from "../ai/settingsSlots";
import {TOPOS_VAULT_FORMAT} from "../ai/localVaultStore";
import * as vault from "../ai/localVaultStore";
import {isBackendAvailable} from "../utils/backendStatus";
import {useDialog} from "./AppDialog";
import {useI18n} from "../hooks/useI18n";
import {notify, errorMessage} from "../utils/notify";
import {btn, btnText, input, muted, danger} from "../ui/classes";

type SettingsMode = "backend" | "local";
type LocalGate = "create" | "locked" | "unlocked";

const USER_ID = "topos"; // single-user app; the adapters ignore this

/** Which local-vault gate to show, derived from the store singleton. */
function computeGate(): LocalGate {
    if (!vault.hasVault()) return "create";
    return vault.isUnlocked() ? "unlocked" : "locked";
}

const notifyApi: NotifyApi = {
    success: (message) => void notify.success(message),
    error: (message) => void notify.error(message),
    warning: (message) => void notify.warning(message),
};

const MIN_PASSPHRASE = 8;

/** First-run gate: choose a passphrase that protects the local key vault. */
function CreatePassphraseGate({onReady}: {onReady: () => void}) {
    const {t} = useI18n();
    const [pass, setPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (pass.length < MIN_PASSPHRASE) {
            notify.warning(
                t(
                    "topos.page.settings.ai.vault_pass_too_short",
                    `Passphrase zu kurz (mindestens ${MIN_PASSPHRASE} Zeichen).`,
                ),
            );
            return;
        }
        if (pass !== confirmPass) {
            notify.warning(
                t("topos.page.settings.ai.vault_pass_mismatch", "Passphrasen stimmen nicht ueberein."),
            );
            return;
        }
        setBusy(true);
        try {
            await vault.createVault(pass);
            notify.success(
                t("topos.page.settings.ai.vault_created", "Schluessel-Tresor angelegt."),
            );
            onReady();
        } catch (err) {
            notify.error(
                errorMessage(err, t("topos.page.settings.ai.vault_create_failed", "Tresor konnte nicht angelegt werden.")),
                err,
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420}}>
            <p className={muted}>
                {t(
                    "topos.page.settings.ai.vault_create_hint",
                    "Waehle eine Passphrase, um die API-Schluessel in diesem Browser verschluesselt zu speichern. Ohne die Passphrase sind die Schluessel nicht wiederherstellbar.",
                )}
            </p>
            <input
                className={input}
                type="password"
                autoComplete="new-password"
                placeholder={t("topos.page.settings.ai.vault_pass", "Passphrase")}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                data-testid="ai-vault-create-pass"
            />
            <input
                className={input}
                type="password"
                autoComplete="new-password"
                placeholder={t("topos.page.settings.ai.vault_pass_confirm", "Passphrase bestaetigen")}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                data-testid="ai-vault-create-confirm"
            />
            <button
                type="button"
                className={btn}
                onClick={submit}
                disabled={busy}
                data-testid="ai-vault-create-button"
            >
                {t("topos.page.settings.ai.vault_create", "Tresor anlegen")}
            </button>
        </div>
    );
}

/** Unlock gate: decrypt the local key vault for this session. */
function UnlockGate({onReady}: {onReady: () => void}) {
    const {t} = useI18n();
    const dialog = useDialog();
    const [pass, setPass] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!pass) return;
        setBusy(true);
        try {
            await vault.unlock(pass);
            setPass("");
            onReady();
        } catch (err) {
            const message =
                err instanceof VaultDecryptError
                    ? t("topos.page.settings.ai.vault_wrong_pass", "Falsche Passphrase.")
                    : errorMessage(err, t("topos.page.settings.ai.vault_unlock_failed", "Entsperren fehlgeschlagen."));
            notify.error(message, err);
        } finally {
            setBusy(false);
        }
    }

    async function forget() {
        const ok = await dialog.confirm(
            t("topos.page.settings.ai.vault_forget_title", "Tresor zuruecksetzen?"),
            t(
                "topos.page.settings.ai.vault_forget_message",
                "Ohne die Passphrase sind die gespeicherten Schluessel nicht wiederherstellbar. Der Tresor wird geleert und du kannst eine neue Passphrase festlegen.",
            ),
            "danger",
        );
        if (!ok) return;
        vault.destroyVault();
        onReady();
    }

    return (
        <div style={{display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420}}>
            <p className={muted}>
                {t(
                    "topos.page.settings.ai.vault_unlock_hint",
                    "Gib die Passphrase ein, um die gespeicherten API-Schluessel fuer diese Sitzung zu entsperren.",
                )}
            </p>
            <input
                className={input}
                type="password"
                autoComplete="current-password"
                placeholder={t("topos.page.settings.ai.vault_pass", "Passphrase")}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                }}
                data-testid="ai-vault-unlock-pass"
            />
            <div style={{display: "flex", gap: "0.5rem"}}>
                <button
                    type="button"
                    className={btn}
                    onClick={submit}
                    disabled={busy || !pass}
                    data-testid="ai-vault-unlock-button"
                >
                    {t("topos.page.settings.ai.vault_unlock", "Entsperren")}
                </button>
                <button
                    type="button"
                    className={btnText}
                    onClick={forget}
                    data-testid="ai-vault-forgot-button"
                >
                    {t("topos.page.settings.ai.vault_forgot", "Passphrase vergessen?")}
                </button>
            </div>
        </div>
    );
}

export default function AiProviderSettings() {
    const {t} = useI18n();
    const dialog = useDialog();
    const [mode, setMode] = useState<SettingsMode | null>(null);
    const [enabled, setEnabled] = useState(false);
    // Re-derived on create / unlock / lock; only meaningful in local mode.
    const [gate, setGate] = useState<LocalGate>("create");

    const backendAdapter = useMemo(() => createBackendAdapter(), []);
    const localAdapter = useMemo(() => createLocalVaultAdapter(), []);

    const confirmFn = useCallback<ConfirmFn>(
        (options) =>
            dialog.confirm(
                t("topos.page.settings.ai.confirm_title", "Bestaetigen"),
                options.message,
                options.variant === "danger" ? "danger" : undefined,
                {confirmLabel: options.confirmLabel},
            ),
        [dialog, t],
    );

    useEffect(() => {
        let cancelled = false;
        function toLocal() {
            if (cancelled) return;
            setEnabled(vault.isEnabled());
            setGate(computeGate());
            setMode("local");
        }
        void (async () => {
            // Offline (no-backend PWA): go straight to local mode without
            // touching the API. The health probe is the single source of
            // truth for "is a backend reachable".
            if (!(await isBackendAvailable())) {
                toLocal();
                return;
            }
            try {
                const cfg = await api.settings.getApp();
                if (cancelled) return;
                setEnabled(Boolean(cfg.ai?.enabled));
                setMode("backend");
            } catch {
                toLocal();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function onToggleEnabled(next: boolean) {
        setEnabled(next);
        try {
            if (mode === "backend") {
                await api.settings.updateApp({ai: {enabled: next}});
            } else {
                vault.setEnabled(next);
            }
        } catch (err) {
            notify.error(
                errorMessage(err, t("topos.page.settings.ai.save_failed", "Speichern fehlgeschlagen")),
                err,
            );
            setEnabled(!next); // revert optimistic flip
        }
    }

    function afterVaultChange() {
        setGate(computeGate());
        emitSettingsRefresh();
    }

    if (mode === null) return null;

    const localReady = mode === "local" && gate === "unlocked";

    return (
        <section style={{marginBottom: "1.5rem"}} data-testid="ai-settings-section">
            <h2>{t("topos.page.settings.ai.title", "KI-Assistent")}</h2>
            <p className={muted}>
                {t(
                    "topos.page.settings.ai.description",
                    "Anbieter, API-Schluessel und Modell fuer die Bilderkennung von Box-Inhalten.",
                )}
            </p>
            {mode === "local" && (
                <p data-testid="ai-settings-local-hint" className={muted}>
                    {t(
                        "topos.page.settings.ai.local_mode",
                        "Kein Backend verbunden: Einstellungen und API-Schluessel werden nur in diesem Browser gespeichert, KI-Anfragen gehen direkt an den Anbieter.",
                    )}
                </p>
            )}

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
                    onChange={(e) => onToggleEnabled(e.target.checked)}
                    data-testid="ai-enable-toggle"
                    style={{width: 20, height: 20}}
                />
                {t("topos.page.settings.ai.enable", "KI-Funktionen aktivieren")}
            </label>

            {mode === "backend" && (
                <AiSettingsProvider
                    adapter={backendAdapter}
                    registry={TOPOS_REGISTRY}
                    userId={USER_ID}
                    t={t}
                    notify={notifyApi}
                    confirm={confirmFn}
                    browserRuntime={false}
                    Button={ToposButton}
                    Input={ToposInput}
                    Link={ToposLink}
                >
                    <AiSettingsPanel />
                    <CustomEndpointField />
                </AiSettingsProvider>
            )}

            {mode === "local" && gate === "create" && (
                <CreatePassphraseGate onReady={afterVaultChange} />
            )}

            {mode === "local" && gate === "locked" && (
                <UnlockGate onReady={afterVaultChange} />
            )}

            {localReady && (
                <AiSettingsProvider
                    adapter={localAdapter}
                    registry={TOPOS_REGISTRY}
                    userId={USER_ID}
                    t={t}
                    notify={notifyApi}
                    confirm={confirmFn}
                    vaultFormat={TOPOS_VAULT_FORMAT}
                    browserRuntime={true}
                    Button={ToposButton}
                    Input={ToposInput}
                    Link={ToposLink}
                >
                    <AiSettingsPanel />
                    <CustomEndpointField />
                    <KeyVaultSection />
                    <button
                        type="button"
                        className={btnText}
                        style={{marginTop: "1rem"}}
                        onClick={() => {
                            vault.lock();
                            afterVaultChange();
                        }}
                        data-testid="ai-vault-lock-button"
                    >
                        {t("topos.page.settings.ai.vault_lock", "Tresor sperren")}
                    </button>
                </AiSettingsProvider>
            )}

            {mode === "local" && !enabled && (
                <p className={danger} style={{fontSize: "0.8125rem", marginTop: "0.5rem"}}>
                    {t(
                        "topos.page.settings.ai.enable_hint",
                        "Aktiviere die KI-Funktionen oben, damit die Bilderkennung die gespeicherten Schluessel nutzt.",
                    )}
                </p>
            )}
        </section>
    );
}

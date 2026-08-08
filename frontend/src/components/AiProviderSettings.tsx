/**
 * AI provider settings, built on ``@astrapi69/ai-key-vault-react``.
 *
 * Two modes:
 *
 * - **Backend mode** (a backend answers): keys live in the server config
 *   chain (env / ``secrets.yaml`` / ``app.yaml`` overlay), write-only from the
 *   client. The ``backendAdapter`` maps the panel onto ``/api/settings/*``.
 * - **Local mode** (no backend: GitHub Pages PWA / Dexie-only): keys live in a
 *   passphrase-encrypted vault in this browser. The provider panel is shown
 *   immediately - the user can pick a provider and model with no passphrase.
 *   A passphrase is requested LAZILY, only when the first API key is saved
 *   (or an existing locked vault is edited); keys are never persisted
 *   unencrypted. Once unlocked, the encrypted ``.alk`` key-vault export/import
 *   (for moving keys between devices) is also shown.
 *
 * The ``enabled`` flag is a Topos concept the kit has no notion of, so it
 * stays a wrapper-level toggle (persisted to the backend ``ai.enabled`` or the
 * local vault metadata).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AiSettingsPanel,
  AiSettingsProvider,
  KeyVaultImportForm,
  KeyVaultSection,
  type ConfirmFn,
  type NotifyApi,
} from "@astrapi69/ai-key-vault-react";
import { emitSettingsRefresh } from "@astrapi69/ai-key-vault";
import { VaultDecryptError } from "@astrapi69/passphrase-vault";

import { api } from "../api/client";
import { createBackendAdapter } from "../ai/backendAdapter";
import {
  createLocalVaultAdapter,
  type EnsureUnlocked,
} from "../ai/localVaultAdapter";
import CustomEndpointField from "../ai/CustomEndpointField";
import { TOPOS_REGISTRY } from "../ai/registry";
import { wrapKitT } from "../ai/kitI18n";
import { ToposButton, ToposInput, ToposLink } from "../ai/settingsSlots";
import { TOPOS_VAULT_FORMAT } from "../ai/localVaultStore";
import * as vault from "../ai/localVaultStore";
import { isBackendAvailable } from "../utils/backendStatus";
import { useDialog } from "./AppDialog";
import { useI18n } from "../hooks/useI18n";
import { notify, errorMessage } from "../utils/notify";
import { btn, btnText, input, muted, danger } from "../ui/classes";

type SettingsMode = "backend" | "local";
type PromptMode = "create" | "unlock";

const USER_ID = "topos"; // single-user app; the adapters ignore this
const MIN_PASSPHRASE = 8;

const notifyApi: NotifyApi = {
  success: (message) => void notify.success(message),
  error: (message) => void notify.error(message),
  warning: (message) => void notify.warning(message),
};

/**
 * Passphrase form used inside the lazy prompt modal. ``kind`` picks create
 * (choose + confirm a new passphrase) vs unlock (enter the existing one).
 * On success it opens the session and calls ``onReady``; ``onCancel`` aborts.
 */
export function VaultPassphraseForm({
  kind,
  onReady,
  onCancel,
}: {
  kind: PromptMode;
  onReady: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const dialog = useDialog();
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (kind === "create") {
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
          t(
            "topos.page.settings.ai.vault_pass_mismatch",
            "Passphrasen stimmen nicht ueberein.",
          ),
        );
        return;
      }
    } else if (!pass) {
      return;
    }
    setBusy(true);
    try {
      if (kind === "create") await vault.createVault(pass);
      else await vault.unlock(pass);
      setPass("");
      setConfirmPass("");
      onReady();
    } catch (err) {
      const message =
        err instanceof VaultDecryptError
          ? t("topos.page.settings.ai.vault_wrong_pass", "Falsche Passphrase.")
          : errorMessage(
              err,
              kind === "create"
                ? t(
                    "topos.page.settings.ai.vault_create_failed",
                    "Tresor konnte nicht angelegt werden.",
                  )
                : t(
                    "topos.page.settings.ai.vault_unlock_failed",
                    "Entsperren fehlgeschlagen.",
                  ),
            );
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
    onCancel();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      data-testid={
        kind === "create" ? "ai-vault-create-gate" : "ai-vault-unlock-gate"
      }
    >
      <p style={{ margin: 0, fontWeight: 600 }} className="text-ink">
        {kind === "create"
          ? t(
              "topos.page.settings.ai.vault_create_heading",
              "Passphrase festlegen, um den Schluessel verschluesselt zu speichern",
            )
          : t(
              "topos.page.settings.ai.vault_unlock_heading",
              "Passphrase eingeben, um die gespeicherten Schluessel zu entsperren",
            )}
      </p>
      <p className={muted}>
        {kind === "create"
          ? t(
              "topos.page.settings.ai.vault_create_hint",
              "Ohne Backend werden die API-Schluessel in diesem Browser verschluesselt gespeichert. Waehle dazu eine Passphrase; ohne sie sind die Schluessel nicht wiederherstellbar.",
            )
          : t(
              "topos.page.settings.ai.vault_unlock_hint",
              "Gib die Passphrase ein, um die gespeicherten API-Schluessel fuer diese Sitzung zu entsperren.",
            )}
      </p>
      <input
        className={input}
        type="password"
        autoComplete={kind === "create" ? "new-password" : "current-password"}
        placeholder={t("topos.page.settings.ai.vault_pass", "Passphrase")}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        data-testid={
          kind === "create" ? "ai-vault-create-pass" : "ai-vault-unlock-pass"
        }
      />
      {kind === "create" && (
        <input
          className={input}
          type="password"
          autoComplete="new-password"
          placeholder={t(
            "topos.page.settings.ai.vault_pass_confirm",
            "Passphrase bestaetigen",
          )}
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
          data-testid="ai-vault-create-confirm"
        />
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          className={btn}
          disabled={busy || (kind === "unlock" && !pass)}
          data-testid={
            kind === "create"
              ? "ai-vault-create-button"
              : "ai-vault-unlock-button"
          }
        >
          {kind === "create"
            ? t("topos.page.settings.ai.vault_create", "Tresor anlegen")
            : t("topos.page.settings.ai.vault_unlock", "Entsperren")}
        </button>
        <button
          type="button"
          className={btnText}
          onClick={onCancel}
          data-testid="ai-vault-cancel-button"
        >
          {t("topos.page.settings.ai.vault_cancel", "Abbrechen")}
        </button>
        {kind === "unlock" && (
          <button
            type="button"
            className={btnText}
            onClick={forget}
            data-testid="ai-vault-forgot-button"
          >
            {t("topos.page.settings.ai.vault_forgot", "Passphrase vergessen?")}
          </button>
        )}
      </div>
    </form>
  );
}

export default function AiProviderSettings() {
  const { t, lang } = useI18n();
  // Layer bundled DE/EN kit strings under t so the panel is localized
  // even offline (no backend catalog); a loaded catalog still wins.
  const kitT = useMemo(() => wrapKitT(t, lang), [t, lang]);
  const dialog = useDialog();
  const [mode, setMode] = useState<SettingsMode | null>(null);
  const [enabled, setEnabled] = useState(false);
  // Bumped on any vault lifecycle change (create / unlock / lock / destroy)
  // to re-derive unlocked-ness for the export section + lock/unlock controls.
  const [vaultTick, setVaultTick] = useState(0);
  const [promptMode, setPromptMode] = useState<PromptMode | null>(null);
  const promptResolve = useRef<((ok: boolean) => void) | null>(null);
  // Shared pending prompt so concurrent requestUnlock() callers (a multi-key
  // import) get one dialog, not one per key.
  const pendingUnlock = useRef<Promise<boolean> | null>(null);

  const backendAdapter = useMemo(() => createBackendAdapter(), []);
  // The adapter calls back into requestUnlock (via the ref) when a key save
  // needs a passphrase; the ref indirection keeps the adapter identity stable.
  const requestUnlockRef = useRef<EnsureUnlocked>(async () =>
    vault.isUnlocked(),
  );
  const localAdapter = useMemo(
    () => createLocalVaultAdapter(() => requestUnlockRef.current()),
    [],
  );

  const confirmFn = useCallback<ConfirmFn>(
    (options) =>
      dialog.confirm(
        t("topos.page.settings.ai.confirm_title", "Bestaetigen"),
        options.message,
        options.variant === "danger" ? "danger" : undefined,
        { confirmLabel: options.confirmLabel },
      ),
    [dialog, t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Offline (no-backend PWA): go straight to local mode without touching
      // the API. The health probe is the single source of truth.
      if (!(await isBackendAvailable())) {
        if (cancelled) return;
        setEnabled(vault.isEnabled());
        setMode("local");
        return;
      }
      try {
        const cfg = await api.settings.getApp();
        if (cancelled) return;
        setEnabled(Boolean(cfg.ai?.enabled));
        setMode("backend");
      } catch {
        if (cancelled) return;
        setEnabled(vault.isEnabled());
        setMode("local");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function afterVaultChange() {
    setVaultTick((n) => n + 1);
    emitSettingsRefresh();
  }

  /**
   * Ensure an open vault session, prompting for a passphrase if needed. Passed
   * to the local adapter; resolves true once unlocked, false on cancel.
   *
   * A single import writes several keys back-to-back (one setApiKey per
   * provider), each calling this. Dedupe to ONE prompt: concurrent callers
   * share the pending promise, and once the first create/unlock succeeds the
   * rest see an open session and skip the prompt entirely.
   */
  const requestUnlock = useCallback<EnsureUnlocked>(() => {
    if (vault.isUnlocked()) return Promise.resolve(true);
    if (pendingUnlock.current) return pendingUnlock.current;
    const pending = new Promise<boolean>((resolve) => {
      promptResolve.current = resolve;
    });
    pendingUnlock.current = pending;
    setPromptMode(vault.hasVault() ? "unlock" : "create");
    return pending;
  }, []);

  useEffect(() => {
    requestUnlockRef.current = requestUnlock;
  }, [requestUnlock]);

  function resolvePrompt(ok: boolean) {
    if (ok) afterVaultChange();
    promptResolve.current?.(ok);
    promptResolve.current = null;
    pendingUnlock.current = null;
    setPromptMode(null);
  }

  async function onToggleEnabled(next: boolean) {
    setEnabled(next);
    try {
      if (mode === "backend") {
        await api.settings.updateApp({ ai: { enabled: next } });
      } else {
        vault.setEnabled(next);
      }
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t("topos.page.settings.ai.save_failed", "Speichern fehlgeschlagen"),
        ),
        err,
      );
      setEnabled(!next); // revert optimistic flip
    }
  }

  if (mode === null) return null;

  // ``vaultTick`` is read so this recomputes after every lifecycle change.
  void vaultTick;
  const unlocked = mode === "local" && vault.isUnlocked();
  const lockedVaultExists = mode === "local" && !unlocked && vault.hasVault();

  return (
    <section
      style={{ marginBottom: "1.5rem" }}
      data-testid="ai-settings-section"
    >
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
          style={{ width: 20, height: 20 }}
        />
        {t("topos.page.settings.ai.enable", "KI-Funktionen aktivieren")}
      </label>

      {mode === "backend" && (
        <AiSettingsProvider
          adapter={backendAdapter}
          registry={TOPOS_REGISTRY}
          userId={USER_ID}
          t={kitT}
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

      {mode === "local" && (
        <>
          {lockedVaultExists && (
            <button
              type="button"
              className={btn}
              style={{ marginBottom: "0.75rem" }}
              onClick={() => void requestUnlock()}
              data-testid="ai-vault-unlock-cta"
            >
              {t(
                "topos.page.settings.ai.vault_unlock_cta",
                "Tresor entsperren",
              )}
            </button>
          )}

          <AiSettingsProvider
            adapter={localAdapter}
            registry={TOPOS_REGISTRY}
            userId={USER_ID}
            t={kitT}
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
            {unlocked ? (
              <>
                <KeyVaultSection />
                <button
                  type="button"
                  className={btnText}
                  style={{ marginTop: "1rem" }}
                  onClick={() => {
                    vault.lock();
                    afterVaultChange();
                  }}
                  data-testid="ai-vault-lock-button"
                >
                  {t("topos.page.settings.ai.vault_lock", "Tresor sperren")}
                </button>
              </>
            ) : (
              // No open session yet: expose the Import half of the key vault so
              // a fresh device can bootstrap its keys from an encrypted .alk
              // file exported elsewhere. Writing the imported keys back prompts
              // for a device passphrase (adapter ensureUnlocked). The full
              // KeyVaultSection (with export) appears once unlocked.
              <div style={{ marginTop: "1rem" }} data-testid="ai-key-import">
                <h3 className="font-semibold">
                  {t(
                    "topos.page.settings.ai.import_keys_heading",
                    "API-Schluessel importieren (verschluesselte Datei)",
                  )}
                </h3>
                <p className={`${muted} mt-1 text-sm`}>
                  {t(
                    "topos.page.settings.ai.import_keys_hint",
                    "Schluessel von einem anderen Geraet uebernehmen: verschluesselte .alk-Datei waehlen (oder Inhalt einfuegen) und deren Passphrase eingeben.",
                  )}
                </p>
                <KeyVaultImportForm onImported={afterVaultChange} />
              </div>
            )}
          </AiSettingsProvider>

          {!enabled && (
            <p
              className={danger}
              style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}
            >
              {t(
                "topos.page.settings.ai.enable_hint",
                "Aktiviere die KI-Funktionen oben, damit die Bilderkennung die gespeicherten Schluessel nutzt.",
              )}
            </p>
          )}
        </>
      )}

      {promptMode && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="ai-vault-prompt"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-overlay, rgba(15,23,42,0.55))",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) resolvePrompt(false);
          }}
        >
          <div
            className="bg-surface border border-line rounded"
            style={{ maxWidth: 440, width: "100%", padding: "1.25rem" }}
          >
            <VaultPassphraseForm
              kind={promptMode}
              onReady={() => resolvePrompt(true)}
              onCancel={() => resolvePrompt(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

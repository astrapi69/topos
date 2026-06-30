/**
 * Error-report dialog.
 *
 * The "Issue melden" button in error toasts (utils/notify.ts) dispatches
 * a ``topos:open-error-report`` window event. This component is the
 * listener: it opens a modal where the user reviews the auto-built bug
 * report (error + technical details + optional environment + their own
 * reproduction steps) and then opens a pre-filled GitHub issue. Without
 * this listener mounted the toast button did nothing.
 *
 * Self-contained (owns the event listener + open state) so App only has
 * to mount it once, next to OfflineBanner.
 */

import {useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Bug, X} from "lucide-react";

import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {btn, btnPrimary, card, input, muted} from "../ui/classes";

const ISSUES_URL = "https://github.com/astrapi69/topos/issues/new";
// GitHub rejects issue URLs over ~8192 chars; encodeURIComponent expands
// spaces/umlauts/markdown ~3x, so trim the raw body until the encoded
// URL fits comfortably.
const MAX_ENCODED_URL = 7800;

interface ReportState {
    open: boolean;
    message: string;
    apiError?: ApiError;
}

export default function ErrorReportDialog() {
    const {t} = useI18n();
    const [state, setState] = useState<ReportState>({open: false, message: ""});
    const [description, setDescription] = useState("");
    const [includeEnv, setIncludeEnv] = useState(true);

    useEffect(() => {
        function handleOpen(event: Event) {
            const detail = (event as CustomEvent).detail ?? {};
            setDescription("");
            setIncludeEnv(true);
            setState({
                open: true,
                message: typeof detail.message === "string" ? detail.message : "",
                apiError: detail.apiError instanceof ApiError ? detail.apiError : undefined,
            });
        }
        window.addEventListener("topos:open-error-report", handleOpen);
        return () => window.removeEventListener("topos:open-error-report", handleOpen);
    }, []);

    function close() {
        setState((prev) => ({...prev, open: false}));
    }

    if (!state.open) return null;

    const issueBody = buildIssueBody(state.message, state.apiError, includeEnv, description);
    const issueTitle = `Bug: ${state.message.substring(0, 80)}`;

    function handleSubmit() {
        const encodedTitle = encodeURIComponent(issueTitle);
        let body = issueBody;
        const baseLen =
            ISSUES_URL.length + "?title=".length + encodedTitle.length + "&body=".length + "&labels=bug".length;
        while (
            baseLen + encodeURIComponent(body).length > MAX_ENCODED_URL &&
            body.length > 200
        ) {
            body = body.substring(0, Math.floor(body.length * 0.8));
            body += `\n\n*(${t("topos.error_report.truncated", "Bericht gekürzt, um GitHubs URL-Längenlimit einzuhalten.")})*`;
        }
        const url = `${ISSUES_URL}?title=${encodedTitle}&body=${encodeURIComponent(body)}&labels=bug`;
        window.open(url, "_blank", "noopener,noreferrer");
        close();
    }

    return (
        <Dialog.Root
            open={state.open}
            onOpenChange={(isOpen) => {
                if (!isOpen) close();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[1000]" />
                <Dialog.Content
                    data-testid="error-report-dialog"
                    aria-describedby="error-report-description"
                    className={`${card} fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-3`}
                >
                    <Dialog.Title className="flex items-center gap-2 m-0 text-lg font-semibold">
                        <Bug size={18} aria-hidden />
                        {t("topos.error_report.title", "Problem melden")}
                    </Dialog.Title>
                    <Dialog.Description
                        id="error-report-description"
                        className={`${muted} text-sm m-0`}
                    >
                        {t(
                            "topos.error_report.intro",
                            "Topos hat einen Fehler erkannt und kann einen Bug-Bericht für die Entwickler vorbereiten. Du siehst vor dem Absenden genau, was übermittelt wird.",
                        )}
                    </Dialog.Description>

                    <label htmlFor="error-report-steps" className="text-sm font-medium">
                        {t("topos.error_report.steps_label", "Schritte zur Reproduktion (optional)")}
                    </label>
                    <textarea
                        id="error-report-steps"
                        data-testid="error-report-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${input} w-full resize-y`}
                        placeholder={t(
                            "topos.error_report.steps_placeholder",
                            "Was hast du gemacht, als der Fehler auftrat? Leer lassen zum Überspringen.",
                        )}
                    />

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeEnv}
                            onChange={(e) => setIncludeEnv(e.target.checked)}
                            data-testid="error-report-include-env"
                        />
                        {t("topos.error_report.include_env", "Umgebungsinfo (Version, Browser, OS)")}
                    </label>

                    <p className={`${muted} text-xs m-0`}>
                        {t(
                            "topos.error_report.privacy",
                            "Es werden keine Inhalte, Passwörter oder API-Schlüssel übermittelt.",
                        )}
                    </p>

                    <details className="text-xs">
                        <summary className="cursor-pointer select-none">
                            {t("topos.error_report.preview", "Vorschau anzeigen")}
                        </summary>
                        <pre
                            data-testid="error-report-preview"
                            className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2"
                        >
                            {issueBody}
                        </pre>
                    </details>

                    <div className="flex flex-wrap gap-2 mt-2">
                        <div className="grow" />
                        <button
                            type="button"
                            className={btn}
                            onClick={close}
                            data-testid="error-report-close"
                        >
                            <X size={14} aria-hidden />
                            {t("topos.error_report.close", "Schließen")}
                        </button>
                        <button
                            type="button"
                            className={btnPrimary}
                            onClick={handleSubmit}
                            data-testid="error-report-submit"
                        >
                            <Bug size={14} aria-hidden />
                            {t("topos.error_report.open_github", "Auf GitHub melden")}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function buildIssueBody(
    message: string,
    apiError: ApiError | undefined,
    includeEnv: boolean,
    description: string,
): string {
    const sections: string[] = [];
    sections.push(`## Fehlerbeschreibung\n${message}`);

    if (apiError) {
        const tech = [
            `- HTTP Status: ${apiError.status}`,
            `- Endpoint: ${apiError.method ?? "?"} ${apiError.endpoint ?? "?"}`,
            `- Timestamp: ${apiError.timestamp ?? ""}`,
        ];
        if (apiError.stacktrace) {
            tech.push(`\n\`\`\`\n${apiError.stacktrace.substring(0, 800)}\n\`\`\``);
        }
        sections.push(`## Technische Details\n${tech.join("\n")}`);
    }

    if (includeEnv) {
        const env = [
            `- Topos Version: ${__APP_VERSION__}`,
            `- Browser: ${navigator.userAgent}`,
            `- Route: ${window.location.pathname}`,
        ];
        sections.push(`## Umgebung\n${env.join("\n")}`);
    }

    const steps = description.trim();
    sections.push(steps ? `## Reproduktion\n${steps}` : "## Reproduktion\n1.\n2.\n3.");

    sections.push(
        "---\n*Automatisch von Topos vorbereitet. Es wurden keine sensiblen Daten übermittelt.*",
    );

    return sections.join("\n\n");
}

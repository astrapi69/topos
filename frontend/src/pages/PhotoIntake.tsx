/**
 * Photo intake: photograph a container's contents, let the AI suggest
 * items, review them in a staging list, commit the accepted ones.
 *
 * Pipeline (human-in-the-loop by design - a photo NEVER auto-imports):
 * capture -> recognize (POST /ai/vision) -> staging (edit/accept/
 * reject) -> commit (POST /items/bulk).
 *
 * Mobile-first: the camera button opens the rear camera via
 * `<input type="file" accept="image/*" capture="environment">`, photos
 * are downscaled client-side before upload, and every control keeps
 * the 44px touch target from ui/classes. Works from the GitHub Pages
 * PWA when a backend URL is configured in Settings. In Dexie-only mode
 * (no backend) recognition still works browser-direct via the local AI
 * settings (adaptive-learner pattern); only the commit needs a backend
 * because the backend stays the source of truth for item writes.
 *
 * Testid namespace: `photo-intake-*`; per-row ids are
 * `photo-intake-row-{index}` plus `-checkbox`, `-label`, `-category`,
 * `-description`, `-confidence`, `-remove` suffixes. The inline
 * container creation uses the `container-quick-create-*` namespace
 * (see components/ContainerQuickCreate).
 */

import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Camera, Plus, Trash2, Upload} from "lucide-react";

import ContainerQuickCreate from "../components/ContainerQuickCreate";
import NavBar from "../components/NavBar";
import {
    getLocalAiConfig,
    getProviderPreset,
    isLocalAiConfigured,
    recognizePhotoDirect,
    resolveLocalAiProvider,
} from "../ai";
import {api, type BulkItemCreate, type RecognizedItem, type VisionResult} from "../api/client";
import type {Container} from "../types/topos";
import {useDialog} from "../components/AppDialog";
import {useI18n} from "../hooks/useI18n";
import {useOnlineStatus} from "../hooks/useOnlineStatus";
import {refreshAll, useCategories, useContainers} from "../hooks/useTopos";
import {rebuildSearchIndex} from "../search/buildIndex";
import {isBackendAvailable} from "../utils/backendStatus";
import {ImageDecodeError, downscaleImage} from "../utils/imageResize";
import {errorMessage, notify} from "../utils/notify";
import {btn, btnPrimary, btnText, card, input, muted, text} from "../ui/classes";

/** Sentinel option value for "create the AI-suggested category". */
const NEW_CATEGORY_OPTION = "__new__";

interface StagedRow {
    key: number;
    selected: boolean;
    label: string;
    categoryPath: string;
    newCategoryHint: string;
    createNewCategory: boolean;
    description: string;
    /** null for manually added rows (no AI involved). */
    confidence: number | null;
}

interface CapturedPhoto {
    blob: Blob;
    fileName: string;
    previewUrl: string;
}

let nextRowKey = 1;

function toStagedRow(recognized: RecognizedItem): StagedRow {
    return {
        key: nextRowKey++,
        selected: true,
        label: recognized.label,
        categoryPath: recognized.categoryPath,
        newCategoryHint: recognized.newCategoryHint,
        createNewCategory: false,
        description: recognized.description,
        confidence: recognized.confidence,
    };
}

function emptyRow(): StagedRow {
    return {
        key: nextRowKey++,
        selected: true,
        label: "",
        categoryPath: "",
        newCategoryHint: "",
        createNewCategory: false,
        description: "",
        confidence: null,
    };
}

export default function PhotoIntake() {
    const {t} = useI18n();
    const {confirm} = useDialog();
    const navigate = useNavigate();
    const online = useOnlineStatus();
    const {data: containers, refresh: refreshContainers} = useContainers();
    const {data: categories} = useCategories();

    const [backendUp, setBackendUp] = useState<boolean | null>(null);
    const [localAiReady, setLocalAiReady] = useState(false);
    const [providerLabel, setProviderLabel] = useState("AI");
    const [containerId, setContainerId] = useState("");
    const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
    const [recognizing, setRecognizing] = useState(false);
    const [recognizedOnce, setRecognizedOnce] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [staged, setStaged] = useState<StagedRow[]>([]);
    const [committing, setCommitting] = useState(false);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        isBackendAvailable().then((available) => {
            if (cancelled) return;
            setBackendUp(available);
            if (!available) {
                // No backend: the browser-local AI settings drive recognition.
                const localConfig = getLocalAiConfig();
                setLocalAiReady(isLocalAiConfigured());
                const preset = getProviderPreset(localConfig.activeProvider);
                setProviderLabel(preset?.label ?? localConfig.activeProvider);
                return;
            }
            void Promise.all([api.settings.getApp(), api.settings.getAiProviders()])
                .then(([config, providers]) => {
                    if (cancelled) return;
                    const active = config.ai?.activeProvider ?? "anthropic";
                    const preset = providers.find((provider) => provider.id === active);
                    setProviderLabel(preset?.label ?? active);
                })
                .catch(() => {
                    /* Privacy notice falls back to the generic "AI" label. */
                });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const backendReady = online && backendUp === true;
    const recognizeReady = backendReady || (online && localAiReady);
    const knownPaths = useMemo(
        () => new Set(categories.map((category) => category.path)),
        [categories],
    );
    const selectedContainer = containers.find((row) => String(row.id) === containerId);
    const committableRows = staged.filter((row) => row.selected && row.label.trim() !== "");

    async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
        const picked = event.target.files?.[0];
        event.target.value = "";
        if (!picked) return;
        try {
            const scaled = await downscaleImage(picked);
            setPhoto((previous) => {
                if (previous) URL.revokeObjectURL(previous.previewUrl);
                return {
                    blob: scaled.blob,
                    fileName: scaled.fileName,
                    previewUrl: URL.createObjectURL(scaled.blob),
                };
            });
        } catch (err) {
            const fallback = t(
                "topos.page.photo_intake.decode_failed",
                "Bild konnte nicht gelesen werden (Format nicht unterstützt, z. B. HEIC).",
            );
            notify.error(
                err instanceof ImageDecodeError ? fallback : errorMessage(err, fallback),
                err,
            );
        }
    }

    function requestRecognition(
        photoData: CapturedPhoto,
        container: Container,
    ): Promise<VisionResult> {
        if (backendReady) {
            return api.ai.recognize(photoData.blob, {
                containerId: container.id,
                containerType: container.type,
                fileName: photoData.fileName,
            });
        }
        const resolved = resolveLocalAiProvider();
        if (!resolved) {
            throw new Error(
                t(
                    "topos.page.photo_intake.offline",
                    "Foto-Erkennung benötigt eine Backend-Verbindung oder gespeicherte KI-Einstellungen (Einstellungen: KI-Assistent).",
                ),
            );
        }
        return recognizePhotoDirect(resolved, {
            photo: photoData.blob,
            mediaType: photoData.blob.type || "image/jpeg",
            containerType: container.type,
            categories: categories.map((category) => category.path),
        });
    }

    async function handleRecognize() {
        if (!photo || !selectedContainer || recognizing || !recognizeReady) return;
        if (!privacyAccepted) {
            const accepted = await confirm(
                t("topos.page.photo_intake.privacy_title", "Foto an AI-Provider senden?"),
                t(
                    "topos.page.photo_intake.privacy_notice",
                    "Das Foto wird zur Analyse an {provider} gesendet.",
                ).replace("{provider}", providerLabel),
                "default",
                {
                    confirmLabel: t("topos.page.photo_intake.recognize", "Erkennen"),
                    cancelLabel: t("topos.common.cancel", "Abbrechen"),
                },
            );
            if (!accepted) return;
            setPrivacyAccepted(true);
        }
        setRecognizing(true);
        try {
            const recognition = await requestRecognition(photo, selectedContainer);
            setStaged((previous) => [...previous, ...recognition.items.map(toStagedRow)]);
            setRecognizedOnce(true);
        } catch (err) {
            notify.error(
                errorMessage(
                    err,
                    t("topos.toast.photo_recognize_failed", "Erkennung fehlgeschlagen"),
                ),
                err,
            );
        } finally {
            setRecognizing(false);
        }
    }

    function updateRow(key: number, patch: Partial<StagedRow>) {
        setStaged((previous) =>
            previous.map((row) => (row.key === key ? {...row, ...patch} : row)),
        );
    }

    function onCategoryChange(row: StagedRow, value: string) {
        if (value === NEW_CATEGORY_OPTION) {
            updateRow(row.key, {createNewCategory: true});
        } else {
            updateRow(row.key, {createNewCategory: false, categoryPath: value});
        }
    }

    function toBulkPayload(row: StagedRow): BulkItemCreate {
        const wantsNewCategory = row.createNewCategory && row.newCategoryHint.trim() !== "";
        return {
            containerId: selectedContainer?.id ?? Number(containerId),
            content: row.label.trim(),
            notes: row.description.trim() === "" ? null : row.description.trim(),
            categoryPath: !wantsNewCategory && row.categoryPath ? row.categoryPath : null,
            newCategoryPath: wantsNewCategory ? row.newCategoryHint.trim() : null,
        };
    }

    async function handleCommit() {
        if (committableRows.length === 0 || !selectedContainer || committing || !backendReady) {
            return;
        }
        setCommitting(true);
        try {
            const bulkResult = await api.items.bulkCreate(committableRows.map(toBulkPayload));
            await refreshAll();
            await rebuildSearchIndex();
            if (bulkResult.errors.length === 0) {
                notify.success(
                    t("topos.page.photo_intake.committed", "{count} Items übernommen").replace(
                        "{count}",
                        String(bulkResult.created.length),
                    ),
                );
                navigate(`/containers/${selectedContainer.id}`);
                return;
            }
            // Partial success: keep only the failed rows for a retry.
            const failedIndices = new Set(bulkResult.errors.map((error) => error.index));
            const failedKeys = new Set(
                committableRows.filter((_, index) => failedIndices.has(index)).map((r) => r.key),
            );
            setStaged((previous) => previous.filter((row) => failedKeys.has(row.key)));
            notify.error(
                t(
                    "topos.page.photo_intake.commit_partial",
                    "{failed} von {total} Zeilen fehlgeschlagen",
                )
                    .replace("{failed}", String(bulkResult.errors.length))
                    .replace("{total}", String(committableRows.length)),
            );
        } catch (err) {
            notify.error(
                errorMessage(err, t("topos.toast.photo_commit_failed", "Übernahme fehlgeschlagen")),
                err,
            );
        } finally {
            setCommitting(false);
        }
    }

    const commitLabel = t("topos.page.photo_intake.commit", "{count} Items übernehmen").replace(
        "{count}",
        String(committableRows.length),
    );

    return (
        <>
            <NavBar />
            <main className={`p-4 sm:p-6 max-w-3xl ${text}`}>
                <h1 data-testid="photo-intake-title" className="text-2xl font-bold mb-1">
                    {t("topos.page.photo_intake.title", "Foto-Erfassung")}
                </h1>
                <p className={`${muted} mb-4`}>
                    {t(
                        "topos.page.photo_intake.description",
                        "Fotografiere den Inhalt eines Containers. Die KI schlägt Einträge vor, die du prüfst und übernimmst.",
                    )}
                </p>

                <section className={`${card} p-4 mb-6 flex flex-col gap-3`}>
                    <label className="flex flex-col gap-1">
                        <span>
                            {t("topos.page.photo_intake.select_container", "In welchen Container?")}
                        </span>
                        <select
                            data-testid="photo-intake-container-select"
                            className={input}
                            value={containerId}
                            onChange={(event) => setContainerId(event.target.value)}
                        >
                            <option value="">
                                {t(
                                    "topos.page.photo_intake.select_container_placeholder",
                                    "Container wählen...",
                                )}
                            </option>
                            {containers.map((row) => (
                                <option key={row.id} value={row.id}>
                                    {row.externalId} - {row.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex flex-col items-start gap-2">
                        <ContainerQuickCreate
                            disabled={!backendReady}
                            onCreated={(created) => {
                                setContainerId(String(created.id));
                                void refreshContainers();
                            }}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={cameraInputRef}
                            data-testid="photo-intake-camera-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={onFilePicked}
                        />
                        <input
                            ref={fileInputRef}
                            data-testid="photo-intake-file-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onFilePicked}
                        />
                        <button
                            type="button"
                            data-testid="photo-intake-take-photo"
                            className={btn}
                            onClick={() => cameraInputRef.current?.click()}
                        >
                            <Camera size={16} aria-hidden />
                            {t("topos.page.photo_intake.take_photo", "Foto aufnehmen")}
                        </button>
                        <button
                            type="button"
                            data-testid="photo-intake-upload"
                            className={btn}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={16} aria-hidden />
                            {t("topos.page.photo_intake.upload_file", "Datei hochladen")}
                        </button>
                    </div>

                    {photo && (
                        <div className="flex items-center gap-3">
                            <img
                                data-testid="photo-intake-preview"
                                src={photo.previewUrl}
                                alt={photo.fileName}
                                className="max-h-40 rounded border border-gray-300 dark:border-gray-700"
                            />
                            <span className={muted}>
                                {t(
                                    "topos.page.photo_intake.photo_ready",
                                    "Foto bereit: {name}",
                                ).replace("{name}", photo.fileName)}
                            </span>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            data-testid="photo-intake-recognize"
                            className={btnPrimary}
                            disabled={!photo || !selectedContainer || recognizing || !recognizeReady}
                            onClick={() => void handleRecognize()}
                        >
                            {recognizing
                                ? t("topos.page.photo_intake.recognizing", "Inhalte werden erkannt...")
                                : t("topos.page.photo_intake.recognize", "Erkennen")}
                        </button>
                        {!recognizeReady && backendUp !== null && (
                            <span data-testid="photo-intake-offline-hint" className={muted}>
                                {t(
                                    "topos.page.photo_intake.offline",
                                    "Foto-Erkennung benötigt eine Backend-Verbindung oder gespeicherte KI-Einstellungen (Einstellungen: KI-Assistent).",
                                )}
                            </span>
                        )}
                    </div>
                </section>

                <section data-testid="photo-intake-staging">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h2 className="text-lg font-semibold mr-auto">
                            {t("topos.page.photo_intake.staging_title", "Aufnahmeliste")}
                        </h2>
                        <button
                            type="button"
                            data-testid="photo-intake-select-all"
                            className={btnText}
                            onClick={() =>
                                setStaged((rows) => rows.map((row) => ({...row, selected: true})))
                            }
                        >
                            {t("topos.page.photo_intake.accept_all", "Alle auswählen")}
                        </button>
                        <button
                            type="button"
                            data-testid="photo-intake-deselect-all"
                            className={btnText}
                            onClick={() =>
                                setStaged((rows) => rows.map((row) => ({...row, selected: false})))
                            }
                        >
                            {t("topos.page.photo_intake.reject_all", "Alle abwählen")}
                        </button>
                        <button
                            type="button"
                            data-testid="photo-intake-add-manual"
                            className={btn}
                            onClick={() => setStaged((rows) => [...rows, emptyRow()])}
                        >
                            <Plus size={16} aria-hidden />
                            {t("topos.page.photo_intake.add_manual", "Manuell hinzufügen")}
                        </button>
                    </div>

                    {staged.length === 0 && recognizedOnce && (
                        <p data-testid="photo-intake-no-items" className={muted}>
                            {t("topos.page.photo_intake.no_items", "Keine Einträge erkannt")}
                        </p>
                    )}

                    <ul className="flex flex-col gap-3 list-none p-0 m-0">
                        {staged.map((row, index) => (
                            <StagingRowCard
                                key={row.key}
                                row={row}
                                index={index}
                                knownPaths={knownPaths}
                                categoryPaths={categories.map((category) => category.path)}
                                onToggle={(selected) => updateRow(row.key, {selected})}
                                onLabel={(label) => updateRow(row.key, {label})}
                                onDescription={(description) =>
                                    updateRow(row.key, {description})
                                }
                                onCategory={(value) => onCategoryChange(row, value)}
                                onRemove={() =>
                                    setStaged((rows) => rows.filter((r) => r.key !== row.key))
                                }
                            />
                        ))}
                    </ul>

                    {staged.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                data-testid="photo-intake-commit"
                                className={btnPrimary}
                                disabled={
                                    committableRows.length === 0 ||
                                    !selectedContainer ||
                                    committing ||
                                    !backendReady
                                }
                                onClick={() => void handleCommit()}
                            >
                                {commitLabel}
                            </button>
                            {!backendReady && backendUp !== null && (
                                <span
                                    data-testid="photo-intake-commit-offline-hint"
                                    className={muted}
                                >
                                    {t(
                                        "topos.page.photo_intake.commit_offline",
                                        "Übernehmen benötigt eine Backend-Verbindung.",
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}

function confidenceBadge(confidence: number, t: (key: string, fallback?: string) => string) {
    if (confidence > 0.8) {
        return {
            label: t("topos.page.photo_intake.confidence_high", "Hoch"),
            classes:
                "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        };
    }
    if (confidence >= 0.5) {
        return {
            label: t("topos.page.photo_intake.confidence_medium", "Mittel"),
            classes:
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
        };
    }
    return {
        label: t("topos.page.photo_intake.confidence_low", "Niedrig"),
        classes: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    };
}

interface StagingRowCardProps {
    row: StagedRow;
    index: number;
    knownPaths: Set<string>;
    categoryPaths: string[];
    onToggle: (selected: boolean) => void;
    onLabel: (label: string) => void;
    onDescription: (description: string) => void;
    onCategory: (value: string) => void;
    onRemove: () => void;
}

function StagingRowCard({
    row,
    index,
    knownPaths,
    categoryPaths,
    onToggle,
    onLabel,
    onDescription,
    onCategory,
    onRemove,
}: StagingRowCardProps) {
    const {t} = useI18n();
    const testId = `photo-intake-row-${index}`;
    const unknownAiPath = row.categoryPath !== "" && !knownPaths.has(row.categoryPath);
    const badge = row.confidence === null ? null : confidenceBadge(row.confidence, t);

    return (
        <li data-testid={testId} className={`${card} p-3 flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    data-testid={`${testId}-checkbox`}
                    checked={row.selected}
                    onChange={(event) => onToggle(event.target.checked)}
                    className="size-5"
                />
                <input
                    data-testid={`${testId}-label`}
                    className={`${input} flex-1 min-w-0`}
                    value={row.label}
                    placeholder={t("topos.page.photo_intake.label", "Bezeichnung")}
                    onChange={(event) => onLabel(event.target.value)}
                />
                {badge && (
                    <span
                        data-testid={`${testId}-confidence`}
                        title={row.confidence?.toFixed(2)}
                        className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${badge.classes}`}
                    >
                        {badge.label} {Math.round((row.confidence ?? 0) * 100)}%
                    </span>
                )}
                <button
                    type="button"
                    data-testid={`${testId}-remove`}
                    aria-label={t("topos.page.photo_intake.remove_row", "Entfernen")}
                    title={t("topos.page.photo_intake.remove_row", "Entfernen")}
                    className="text-red-600 dark:text-red-400 bg-transparent border-0 cursor-pointer p-1"
                    onClick={onRemove}
                >
                    <Trash2 size={18} aria-hidden />
                </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <select
                    data-testid={`${testId}-category`}
                    className={`${input} sm:w-64`}
                    value={row.createNewCategory ? NEW_CATEGORY_OPTION : row.categoryPath}
                    onChange={(event) => onCategory(event.target.value)}
                >
                    <option value="">
                        {t("topos.page.photo_intake.no_category", "Keine Kategorie")}
                    </option>
                    {row.newCategoryHint && (
                        <option value={NEW_CATEGORY_OPTION}>
                            {t("topos.page.photo_intake.new_category", "Neu: {hint}").replace(
                                "{hint}",
                                row.newCategoryHint,
                            )}
                        </option>
                    )}
                    {unknownAiPath && (
                        <option value={row.categoryPath}>{row.categoryPath}</option>
                    )}
                    {categoryPaths.map((path) => (
                        <option key={path} value={path}>
                            {path}
                        </option>
                    ))}
                </select>
                <input
                    data-testid={`${testId}-description`}
                    className={`${input} flex-1 min-w-0`}
                    value={row.description}
                    placeholder={t("topos.page.photo_intake.item_description", "Beschreibung")}
                    onChange={(event) => onDescription(event.target.value)}
                />
            </div>
        </li>
    );
}

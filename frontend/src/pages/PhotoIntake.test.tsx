import "fake-indexeddb/auto";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PhotoIntake from "./PhotoIntake";

const navigateMock = vi.fn();
const confirmMock = vi.fn(async () => true);

vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));

vi.mock("../components/AppDialog", () => ({
    useDialog: () => ({
        confirm: confirmMock,
        prompt: vi.fn(),
        alert: vi.fn(),
        choose: vi.fn(),
    }),
}));

const BASE_CONTAINER = {
    id: 42,
    externalId: 7,
    type: "box",
    owner: "self",
    label: "Kellerbox",
    description: null,
    location: null,
    sizeGroup: null,
    createdAt: "",
    updatedAt: "",
};

const CREATED_CONTAINER = {
    ...BASE_CONTAINER,
    id: 43,
    externalId: 12,
    label: "Neue Box",
};

// Mutable so the refresh mock can make the freshly created container
// show up in the select, mirroring the real read-through cache.
const containersData = [BASE_CONTAINER];
const refreshContainersMock = vi.fn(async () => {
    if (!containersData.some((row) => row.id === CREATED_CONTAINER.id)) {
        containersData.push(CREATED_CONTAINER);
    }
});

vi.mock("../hooks/useTopos", () => ({
    refreshAll: vi.fn(async () => {}),
    useContainers: () => ({
        data: containersData,
        loading: false,
        error: null,
        refresh: refreshContainersMock,
    }),
    useCategories: () => ({
        data: [
            {
                id: 1,
                path: "tools",
                parentPath: null,
                name: "tools",
                displayName: "Werkzeug",
                level: 0,
            },
        ],
        loading: false,
        error: null,
        refresh: vi.fn(),
    }),
}));

vi.mock("../utils/backendStatus", () => ({
    isBackendAvailable: vi.fn(async () => true),
}));

const resolveLocalMock = vi.fn();
const recognizeDirectMock = vi.fn();

vi.mock("../ai", () => ({
    getMeta: vi.fn(() => ({
        enabled: true,
        activeProvider: "anthropic",
        models: {},
        baseUrls: {},
        hasKey: {},
    })),
    TOPOS_REGISTRY: {find: (id: string) => ({id, label: "Anthropic (Claude)"})},
    // Readiness is "the active provider resolves to a usable key" (unlocked).
    resolveActiveProvider: () => resolveLocalMock(),
    recognizePhotoDirect: (...args: unknown[]) => recognizeDirectMock(...args),
}));

vi.mock("../utils/imageResize", () => {
    class ImageDecodeError extends Error {}
    return {
        ImageDecodeError,
        downscaleImage: vi.fn(async () => ({
            blob: new Blob(["jpeg"], {type: "image/jpeg"}),
            fileName: "photo.jpg",
            width: 100,
            height: 100,
        })),
    };
});

vi.mock("../search/buildIndex", () => ({
    rebuildSearchIndex: vi.fn(async () => {}),
    indexUpsertContainer: vi.fn(),
}));

vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), info: vi.fn()},
    errorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("../api/client", () => ({
    ApiError: class extends Error {},
    api: {
        settings: {
            getApp: vi.fn(async () => ({ai: {activeProvider: "anthropic"}})),
            getAiProviders: vi.fn(async () => [
                {id: "anthropic", label: "Anthropic (Claude)"},
            ]),
        },
        ai: {
            recognize: vi.fn(async () => ({
                provider: "anthropic",
                model: "claude-sonnet-4-6",
                items: [
                    {
                        label: "Bohrmaschine",
                        categoryPath: "tools",
                        newCategoryHint: "",
                        description: "Akku-Bohrmaschine",
                        confidence: 0.9,
                    },
                    {
                        label: "Kabel",
                        categoryPath: "",
                        newCategoryHint: "electronics-cables",
                        description: "",
                        confidence: 0.4,
                    },
                ],
            })),
        },
        items: {
            bulkCreate: vi.fn(async () => ({
                created: [{id: 1}, {id: 2}],
                errors: [],
            })),
        },
        containers: {
            create: vi.fn(async () => ({
                id: 43,
                externalId: 12,
                type: "box",
                owner: "self",
                label: "Neue Box",
                description: null,
                location: null,
                sizeGroup: null,
                createdAt: "",
                updatedAt: "",
            })),
        },
        i18n: {get: vi.fn(async () => ({}))},
    },
}));

import {api} from "../api/client";
import {isBackendAvailable} from "../utils/backendStatus";
import {notify} from "../utils/notify";

function renderPage() {
    return render(
        <MemoryRouter>
            <PhotoIntake />
        </MemoryRouter>,
    );
}

async function pickPhotoAndContainer() {
    fireEvent.change(screen.getByTestId("photo-intake-container-select"), {
        target: {value: "42"},
    });
    fireEvent.change(screen.getByTestId("photo-intake-file-input"), {
        target: {files: [new File(["x"], "box.jpg", {type: "image/jpeg"})]},
    });
    await waitFor(() =>
        expect(screen.getByTestId("photo-intake-preview")).toBeInTheDocument(),
    );
}

async function recognize() {
    await pickPhotoAndContainer();
    const recognizeButton = screen.getByTestId("photo-intake-recognize");
    await waitFor(() => expect(recognizeButton).not.toBeDisabled());
    fireEvent.click(recognizeButton);
    await waitFor(() => expect(screen.getByTestId("photo-intake-row-0")).toBeInTheDocument());
}

beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockResolvedValue(true);
    (isBackendAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    resolveLocalMock.mockReturnValue(null);
    containersData.splice(1); // drop containers added by the refresh mock
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
});

describe("PhotoIntake", () => {
    it("renders capture UI with the container dropdown populated", async () => {
        renderPage();
        expect(screen.getByTestId("photo-intake-title")).toBeInTheDocument();
        expect(screen.getByTestId("photo-intake-take-photo")).toBeInTheDocument();
        expect(screen.getByTestId("photo-intake-upload")).toBeInTheDocument();
        expect(screen.getByText("7 - Kellerbox")).toBeInTheDocument();
        // No photo, no container: recognize stays disabled.
        await waitFor(() =>
            expect(screen.getByTestId("photo-intake-recognize")).toBeDisabled(),
        );
    });

    it("shows the privacy notice before the first recognition", async () => {
        renderPage();
        await recognize();
        expect(confirmMock).toHaveBeenCalledTimes(1);
        const [, message] = confirmMock.mock.calls[0] as unknown as [string, string];
        expect(message).toContain("Anthropic (Claude)");
    });

    it("does not recognize when the privacy notice is declined", async () => {
        confirmMock.mockResolvedValue(false);
        renderPage();
        await pickPhotoAndContainer();
        const recognizeButton = screen.getByTestId("photo-intake-recognize");
        await waitFor(() => expect(recognizeButton).not.toBeDisabled());
        fireEvent.click(recognizeButton);
        await waitFor(() => expect(confirmMock).toHaveBeenCalled());
        expect(api.ai.recognize).not.toHaveBeenCalled();
    });

    it("recognizes and fills the staging list with editable rows", async () => {
        renderPage();
        await recognize();
        expect(api.ai.recognize).toHaveBeenCalledWith(expect.any(Blob), {
            containerId: 42,
            containerType: "box",
            fileName: "photo.jpg",
        });
        expect(screen.getByTestId("photo-intake-row-0-label")).toHaveValue("Bohrmaschine");
        expect(screen.getByTestId("photo-intake-row-0-confidence").textContent).toContain(
            "90%",
        );
        expect(screen.getByTestId("photo-intake-row-1-confidence").textContent).toContain(
            "40%",
        );
        fireEvent.change(screen.getByTestId("photo-intake-row-0-label"), {
            target: {value: "Akkuschrauber"},
        });
        expect(screen.getByTestId("photo-intake-row-0-label")).toHaveValue("Akkuschrauber");
    });

    it("commits selected rows via bulkCreate and navigates on full success", async () => {
        renderPage();
        await recognize();
        fireEvent.click(screen.getByTestId("photo-intake-commit"));
        await waitFor(() => expect(api.items.bulkCreate).toHaveBeenCalled());
        const payload = (api.items.bulkCreate as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(payload).toEqual([
            {
                containerId: 42,
                content: "Bohrmaschine",
                notes: "Akku-Bohrmaschine",
                categoryPath: "tools",
                newCategoryPath: null,
            },
            {
                containerId: 42,
                content: "Kabel",
                notes: null,
                categoryPath: null,
                newCategoryPath: null,
            },
        ]);
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/containers/42"));
        expect(notify.success).toHaveBeenCalled();
    });

    it("sends newCategoryPath only after the user picks the new-category option", async () => {
        renderPage();
        await recognize();
        fireEvent.change(screen.getByTestId("photo-intake-row-1-category"), {
            target: {value: "__new__"},
        });
        fireEvent.click(screen.getByTestId("photo-intake-commit"));
        await waitFor(() => expect(api.items.bulkCreate).toHaveBeenCalled());
        const payload = (api.items.bulkCreate as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(payload[1]).toMatchObject({
            content: "Kabel",
            categoryPath: null,
            newCategoryPath: "electronics-cables",
        });
    });

    it("keeps failed rows in staging on partial success", async () => {
        (api.items.bulkCreate as ReturnType<typeof vi.fn>).mockResolvedValue({
            created: [{id: 1}],
            errors: [{index: 1, reason: "content must not be blank"}],
        });
        renderPage();
        await recognize();
        fireEvent.click(screen.getByTestId("photo-intake-commit"));
        await waitFor(() => expect(notify.error).toHaveBeenCalled());
        // Row 0 succeeded and left staging; the failed row remains.
        expect(screen.getByTestId("photo-intake-row-0-label")).toHaveValue("Kabel");
        expect(screen.queryByTestId("photo-intake-row-1")).not.toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("supports manual rows plus select/deselect all", async () => {
        renderPage();
        fireEvent.click(screen.getByTestId("photo-intake-add-manual"));
        fireEvent.change(screen.getByTestId("photo-intake-row-0-label"), {
            target: {value: "Handbeschriftung"},
        });
        expect(screen.getByTestId("photo-intake-row-0-checkbox")).toBeChecked();
        fireEvent.click(screen.getByTestId("photo-intake-deselect-all"));
        expect(screen.getByTestId("photo-intake-row-0-checkbox")).not.toBeChecked();
        fireEvent.click(screen.getByTestId("photo-intake-select-all"));
        expect(screen.getByTestId("photo-intake-row-0-checkbox")).toBeChecked();
        fireEvent.click(screen.getByTestId("photo-intake-row-0-remove"));
        expect(screen.queryByTestId("photo-intake-row-0")).not.toBeInTheDocument();
    });

    it("disables recognition and shows the hint without backend and local AI", async () => {
        (isBackendAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId("photo-intake-offline-hint")).toBeInTheDocument(),
        );
        await pickPhotoAndContainer();
        expect(screen.getByTestId("photo-intake-recognize")).toBeDisabled();
        expect(api.settings.getApp).not.toHaveBeenCalled();
    });

    it("recognizes browser-direct without a backend when local AI is configured", async () => {
        (isBackendAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const resolved = {
            providerId: "anthropic",
            apiKey: "sk-local",
            baseUrl: "https://api.anthropic.com/v1",
            model: "claude-sonnet-4-6",
        };
        resolveLocalMock.mockReturnValue(resolved);
        recognizeDirectMock.mockResolvedValue({
            provider: "anthropic",
            model: "claude-sonnet-4-6",
            items: [
                {
                    label: "Ordnerdeckel",
                    categoryPath: "tools",
                    newCategoryHint: "",
                    description: "",
                    confidence: 0.8,
                },
            ],
        });
        renderPage();
        await recognize();
        // Direct provider call instead of the backend proxy.
        expect(api.ai.recognize).not.toHaveBeenCalled();
        expect(recognizeDirectMock).toHaveBeenCalledWith(resolved, {
            photo: expect.any(Blob),
            mediaType: "image/jpeg",
            containerType: "box",
            categories: ["tools"],
        });
        // The privacy notice names the locally configured provider.
        const [, message] = confirmMock.mock.calls[0] as unknown as [string, string];
        expect(message).toContain("Anthropic (Claude)");
        expect(screen.getByTestId("photo-intake-row-0-label")).toHaveValue("Ordnerdeckel");
        // Committing still needs the backend (Dexie stays a read cache).
        expect(screen.getByTestId("photo-intake-commit")).toBeDisabled();
        expect(
            screen.getByTestId("photo-intake-commit-offline-hint"),
        ).toBeInTheDocument();
    });

    it("creates a container inline and auto-selects it", async () => {
        renderPage();
        // The toggle enables once the backend probe resolves.
        await waitFor(() =>
            expect(screen.getByTestId("container-quick-create-toggle")).not.toBeDisabled(),
        );
        fireEvent.click(screen.getByTestId("container-quick-create-toggle"));
        fireEvent.change(screen.getByTestId("container-quick-create-external-id"), {
            target: {value: "12"},
        });
        fireEvent.change(screen.getByTestId("container-quick-create-label"), {
            target: {value: "Neue Box"},
        });
        fireEvent.submit(screen.getByTestId("container-quick-create-form"));

        await waitFor(() => expect(api.containers.create).toHaveBeenCalled());
        expect(refreshContainersMock).toHaveBeenCalled();
        // The fresh container is selected as the photo target right away.
        await waitFor(() =>
            expect(screen.getByTestId("photo-intake-container-select")).toHaveValue("43"),
        );
        expect(screen.getByText("12 - Neue Box")).toBeInTheDocument();
        expect(
            screen.queryByTestId("container-quick-create-form"),
        ).not.toBeInTheDocument();
    });

    it("disables the inline container creation without a backend", async () => {
        (isBackendAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId("container-quick-create-toggle")).toBeDisabled(),
        );
    });
});

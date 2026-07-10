import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerQuickCreate from "./ContainerQuickCreate";
import {api} from "../api/client";
import {notify} from "../utils/notify";

vi.mock("../api/client", () => ({
    api: {
        containers: {
            create: vi.fn(),
        },
    },
}));

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k}),
}));

vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn()},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("../search/buildIndex", () => ({
    indexUpsertContainer: vi.fn(),
}));

const CREATED = {
    id: 43,
    externalId: 12,
    type: "box",
    owner: "self",
    label: "Neue Kellerbox",
    description: null,
    location: null,
    sizeGroup: null,
    createdAt: "",
    updatedAt: "",
};

const createMock = api.containers.create as ReturnType<typeof vi.fn>;

function openForm(onCreated = vi.fn()) {
    render(<ContainerQuickCreate onCreated={onCreated} />);
    fireEvent.click(screen.getByTestId("container-quick-create-toggle"));
    return onCreated;
}

function fillValidForm() {
    fireEvent.change(screen.getByTestId("container-quick-create-external-id"), {
        target: {value: "12"},
    });
    fireEvent.change(screen.getByTestId("container-quick-create-label"), {
        target: {value: "Neue Kellerbox"},
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue(CREATED);
});

describe("ContainerQuickCreate", () => {
    it("starts collapsed and expands to the required-fields form", () => {
        render(<ContainerQuickCreate onCreated={vi.fn()} />);
        expect(screen.queryByTestId("container-quick-create-form")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("container-quick-create-toggle"));
        expect(screen.getByTestId("container-quick-create-form")).toBeInTheDocument();
        expect(screen.getByTestId("container-quick-create-external-id")).toBeInTheDocument();
        expect(screen.getByTestId("container-quick-create-type")).toHaveValue("box");
        expect(screen.getByTestId("container-quick-create-owner")).toHaveValue("self");
        expect(screen.getByTestId("container-quick-create-label")).toBeInTheDocument();
    });

    it("is disabled while no backend answers", () => {
        render(<ContainerQuickCreate disabled onCreated={vi.fn()} />);
        expect(screen.getByTestId("container-quick-create-toggle")).toBeDisabled();
    });

    it("creates the container and hands it to onCreated", async () => {
        const onCreated = openForm();
        fillValidForm();
        fireEvent.change(screen.getByTestId("container-quick-create-type"), {
            target: {value: "folder"},
        });
        fireEvent.submit(screen.getByTestId("container-quick-create-form"));
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED));
        expect(createMock).toHaveBeenCalledWith({
            externalId: 12,
            type: "folder",
            owner: "self",
            label: "Neue Kellerbox",
            description: null,
            location: null,
            sizeGroup: null,
        });
        expect(notify.success).toHaveBeenCalled();
        // The form collapses back to the toggle after a successful create.
        expect(screen.queryByTestId("container-quick-create-form")).not.toBeInTheDocument();
    });

    it("requires a label before calling the API", async () => {
        const onCreated = openForm();
        fireEvent.change(screen.getByTestId("container-quick-create-external-id"), {
            target: {value: "12"},
        });
        fireEvent.submit(screen.getByTestId("container-quick-create-form"));
        await waitFor(() => expect(notify.warning).toHaveBeenCalled());
        expect(createMock).not.toHaveBeenCalled();
        expect(onCreated).not.toHaveBeenCalled();
    });

    it("requires an integer external id before calling the API", async () => {
        const onCreated = openForm();
        fireEvent.change(screen.getByTestId("container-quick-create-label"), {
            target: {value: "Neue Kellerbox"},
        });
        fireEvent.change(screen.getByTestId("container-quick-create-external-id"), {
            target: {value: "12.5"},
        });
        fireEvent.submit(screen.getByTestId("container-quick-create-form"));
        await waitFor(() => expect(notify.warning).toHaveBeenCalled());
        expect(createMock).not.toHaveBeenCalled();
        expect(onCreated).not.toHaveBeenCalled();
    });

    it("keeps the form open and reports the error when the API fails", async () => {
        createMock.mockRejectedValue(new Error("409 duplicate"));
        const onCreated = openForm();
        fillValidForm();
        fireEvent.submit(screen.getByTestId("container-quick-create-form"));
        await waitFor(() => expect(notify.error).toHaveBeenCalled());
        expect(onCreated).not.toHaveBeenCalled();
        expect(screen.getByTestId("container-quick-create-form")).toBeInTheDocument();
    });

    it("cancel collapses and resets the fields", () => {
        openForm();
        fireEvent.change(screen.getByTestId("container-quick-create-label"), {
            target: {value: "Wegwerfen"},
        });
        fireEvent.click(screen.getByTestId("container-quick-create-cancel"));
        expect(screen.queryByTestId("container-quick-create-form")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("container-quick-create-toggle"));
        expect(screen.getByTestId("container-quick-create-label")).toHaveValue("");
    });
});

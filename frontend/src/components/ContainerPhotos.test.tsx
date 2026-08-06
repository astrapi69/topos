import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerPhotos from "./ContainerPhotos";

const mocks = vi.hoisted(() => ({
    add: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    confirm: vi.fn(async () => true),
}));

vi.mock("../photos", () => ({
    addPhoto: mocks.add,
    removePhoto: mocks.remove,
    useContainerPhotos: () => ({
        items: [{id: 1, thumbSrc: "thumb-1", fullSrc: "full-1", mime: "image/jpeg"}],
        loading: false,
        refresh: mocks.refresh,
    }),
}));
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "de"}),
}));
vi.mock("./AppDialog", () => ({
    useDialog: () => ({confirm: mocks.confirm, prompt: vi.fn(), alert: vi.fn(), choose: vi.fn()}),
}));
vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn()},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

beforeEach(() => vi.clearAllMocks());

describe("ContainerPhotos", () => {
    it("renders camera + add buttons and the thumbnail grid", () => {
        render(<ContainerPhotos containerId={5} />);
        expect(screen.getByTestId("container-photos-camera")).toBeInTheDocument();
        expect(screen.getByTestId("container-photos-add")).toBeInTheDocument();
        expect(screen.getByTestId("container-photo-1")).toBeInTheDocument();
    });

    it("uploads picked files via addPhoto", async () => {
        render(<ContainerPhotos containerId={5} />);
        const file = new File(["x"], "p.jpg", {type: "image/jpeg"});
        fireEvent.change(screen.getByTestId("container-photos-input"), {target: {files: [file]}});
        await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(5, file));
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it("deletes a photo behind a confirm dialog", async () => {
        render(<ContainerPhotos containerId={5} />);
        fireEvent.click(screen.getByTestId("container-photo-delete-1"));
        await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(5, 1));
    });

    it("opens the lightbox on thumbnail click", () => {
        render(<ContainerPhotos containerId={5} />);
        fireEvent.click(screen.getByTestId("container-photo-1").querySelector("button")!);
        expect(screen.getByTestId("photo-lightbox")).toBeInTheDocument();
    });
});

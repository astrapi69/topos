import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContainerLabelsDialog from "./ContainerLabelsDialog";
import type {Container} from "../types/topos";

const printMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/printLabels", () => ({printContainerLabels: printMock}));
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "de"}),
}));
vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn()},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

const CONTAINERS = [
    {id: 1, externalId: 9001, label: "Box A"},
    {id: 2, externalId: 9002, label: "Folder B"},
] as Container[];

beforeEach(() => vi.clearAllMocks());

describe("ContainerLabelsDialog", () => {
    it("lists a checkbox per container and disables print until one is selected", () => {
        render(<ContainerLabelsDialog containers={CONTAINERS} onClose={vi.fn()} />);
        expect(screen.getByTestId("container-labels-item-1")).toBeInTheDocument();
        expect(screen.getByTestId("container-labels-item-2")).toBeInTheDocument();
        expect(screen.getByTestId("container-labels-print")).toBeDisabled();
    });

    it("prints only the selected containers", async () => {
        render(<ContainerLabelsDialog containers={CONTAINERS} onClose={vi.fn()} />);
        const firstCheckbox = screen.getByTestId("container-labels-item-1").querySelector("input")!;
        fireEvent.click(firstCheckbox);
        fireEvent.click(screen.getByTestId("container-labels-print"));
        await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
        expect(printMock.mock.calls[0][0]).toEqual([CONTAINERS[0]]);
    });

    it("select-all selects every container", () => {
        render(<ContainerLabelsDialog containers={CONTAINERS} onClose={vi.fn()} />);
        fireEvent.click(screen.getByTestId("container-labels-select-all"));
        const box2 = screen.getByTestId("container-labels-item-2").querySelector("input");
        expect(box2).toBeChecked();
    });
});

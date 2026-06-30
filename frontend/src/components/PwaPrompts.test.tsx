import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PwaPrompts from "./PwaPrompts";

const {mockUpdate} = vi.hoisted(() => ({mockUpdate: vi.fn()}));

vi.mock("virtual:pwa-register/react", () => ({
    useRegisterSW: () => ({
        needRefresh: [true, vi.fn()],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: mockUpdate,
    }),
}));

beforeEach(() => vi.clearAllMocks());

describe("PwaPrompts", () => {
    it("shows the update bar when a new SW is waiting and updates on click", () => {
        render(<PwaPrompts />);
        expect(screen.getByTestId("pwa-update-bar")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("pwa-update-action"));
        expect(mockUpdate).toHaveBeenCalledWith(true);
    });

    it("offers an install button after beforeinstallprompt and prompts on click", async () => {
        render(<PwaPrompts />);
        expect(screen.queryByTestId("pwa-install")).not.toBeInTheDocument();

        const evt = new Event("beforeinstallprompt") as Event & {
            prompt: () => Promise<void>;
            userChoice: Promise<{outcome: string}>;
        };
        evt.prompt = vi.fn().mockResolvedValue(undefined);
        evt.userChoice = Promise.resolve({outcome: "accepted"});
        act(() => {
            window.dispatchEvent(evt);
        });

        const button = await screen.findByTestId("pwa-install");
        fireEvent.click(button);
        await waitFor(() => expect(evt.prompt).toHaveBeenCalled());
    });
});

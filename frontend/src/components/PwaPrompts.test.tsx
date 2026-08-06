import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import PwaPrompts from "./PwaPrompts";

// PwaPrompts is now the install affordance only; the SW update prompt moved
// to @astrapi69/pwa-update's UpdateBanner (see AppUpdateProvider). i18n is
// mocked so the test does not need the backend catalog.
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_key: string, fallback?: string) => fallback ?? _key, lang: "de"}),
}));

describe("PwaPrompts", () => {
    it("renders nothing until beforeinstallprompt fires", () => {
        render(<PwaPrompts />);
        expect(screen.queryByTestId("pwa-install")).not.toBeInTheDocument();
    });

    it("offers an install button after beforeinstallprompt and prompts on click", async () => {
        render(<PwaPrompts />);

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

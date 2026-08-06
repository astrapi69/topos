import {render, screen, fireEvent, act, waitFor} from "@testing-library/react";
import {describe, it, expect, vi} from "vitest";

import AboutSection from "./AboutSection";
import AppUpdateProvider from "./AppUpdateProvider";

// i18n mocked to the English fallbacks; AppUpdateProvider supplies the
// PwaUpdateProvider context that VersionCard reads its labels from.
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_key: string, fallback?: string) => fallback ?? _key, lang: "en"}),
}));

function renderAbout() {
    return render(
        <AppUpdateProvider>
            <AboutSection />
        </AppUpdateProvider>,
    );
}

describe("AboutSection", () => {
    it("renders the version card with the build version", () => {
        renderAbout();
        expect(screen.getByTestId("about-section")).toBeInTheDocument();
        expect(screen.getByTestId("about-version-card")).toBeInTheDocument();
        expect(screen.getByTestId("about-share-app")).toBeInTheDocument();
        // __APP_VERSION__ is injected by Vite (package.json version).
        expect(screen.getByTestId("about-app-version").textContent).toMatch(/\d+\.\d+\.\d+/);
    });

    it("links to the MIT license and the source repo", () => {
        renderAbout();
        expect(screen.getByTestId("about-license-link")).toHaveAttribute(
            "href",
            "https://github.com/astrapi69/topos/blob/main/LICENSE",
        );
        expect(screen.getByTestId("about-repo-link")).toHaveAttribute(
            "href",
            "https://github.com/astrapi69/topos",
        );
    });

    it("offers the three donation channels with Liberapay preferred", () => {
        renderAbout();
        expect(screen.getByTestId("about-donation-liberapay-link")).toHaveAttribute(
            "href",
            "https://liberapay.com/astrapi69/donate",
        );
        expect(screen.getByTestId("about-donation-github-sponsors-link")).toHaveAttribute(
            "href",
            "https://github.com/sponsors/astrapi69",
        );
        expect(screen.getByTestId("about-donation-kofi-link")).toHaveAttribute(
            "href",
            "https://ko-fi.com/astrapi69",
        );
        expect(screen.getByTestId("about-donation-preferred")).toBeInTheDocument();
    });

    it("opens the error-report dialog via its window event", () => {
        renderAbout();
        const handler = vi.fn();
        window.addEventListener("topos:open-error-report", handler);
        fireEvent.click(screen.getByTestId("about-report-issue"));
        expect(handler).toHaveBeenCalledOnce();
        window.removeEventListener("topos:open-error-report", handler);
    });

    it("offers an install button only after beforeinstallprompt fires", async () => {
        renderAbout();
        expect(screen.queryByTestId("about-install-app")).not.toBeInTheDocument();

        const evt = new Event("beforeinstallprompt") as Event & {
            prompt: () => Promise<void>;
            userChoice: Promise<{outcome: string}>;
        };
        evt.prompt = vi.fn().mockResolvedValue(undefined);
        evt.userChoice = Promise.resolve({outcome: "accepted"});
        act(() => {
            window.dispatchEvent(evt);
        });

        const button = await screen.findByTestId("about-install-app");
        fireEvent.click(button);
        await waitFor(() => expect(evt.prompt).toHaveBeenCalled());
    });
});

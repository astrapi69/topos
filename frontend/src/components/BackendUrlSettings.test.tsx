import "fake-indexeddb/auto";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import BackendUrlSettings from "./BackendUrlSettings";
import {notify} from "../utils/notify";
import {getBackendUrl} from "../api/baseUrl";

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb}),
}));

vi.mock("../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn()},
    errorMessage: (_e: unknown, fb: string) => fb,
}));

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("BackendUrlSettings", () => {
    it("renders the input and test button", () => {
        render(<BackendUrlSettings />);
        expect(screen.getByTestId("backend-url-input")).toBeInTheDocument();
        expect(screen.getByTestId("backend-url-test")).toBeInTheDocument();
    });

    it("saves the url and notifies on a successful connection", async () => {
        const dispatched = vi.fn();
        window.addEventListener("topos:data-refresh", dispatched);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true}));

        render(<BackendUrlSettings />);
        fireEvent.change(screen.getByTestId("backend-url-input"), {
            target: {value: "http://vps.example:8010"},
        });
        fireEvent.click(screen.getByTestId("backend-url-test"));

        await waitFor(() => expect(notify.success).toHaveBeenCalled());
        expect(getBackendUrl()).toBe("http://vps.example:8010");
        expect(dispatched).toHaveBeenCalled();
        window.removeEventListener("topos:data-refresh", dispatched);
    });

    it("does not save and notifies an error when unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        render(<BackendUrlSettings />);
        fireEvent.change(screen.getByTestId("backend-url-input"), {
            target: {value: "http://nope:9999"},
        });
        fireEvent.click(screen.getByTestId("backend-url-test"));

        await waitFor(() => expect(notify.error).toHaveBeenCalled());
        expect(getBackendUrl()).toBe("");
        expect(notify.success).not.toHaveBeenCalled();
    });

    it("probes {url}/api/health", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ok: true});
        vi.stubGlobal("fetch", fetchMock);
        render(<BackendUrlSettings />);
        fireEvent.change(screen.getByTestId("backend-url-input"), {
            target: {value: "http://vps.example:8010"},
        });
        fireEvent.click(screen.getByTestId("backend-url-test"));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(fetchMock.mock.calls[0][0]).toBe("http://vps.example:8010/api/health");
    });
});

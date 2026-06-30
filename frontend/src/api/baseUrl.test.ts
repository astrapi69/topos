import {beforeEach, describe, expect, it} from "vitest";

import {apiBase, getBackendUrl, setBackendUrl} from "./baseUrl";

beforeEach(() => {
    localStorage.clear();
});

describe("baseUrl", () => {
    it("defaults to same-origin /api", () => {
        expect(getBackendUrl()).toBe("");
        expect(apiBase()).toBe("/api");
    });

    it("uses the configured backend origin", () => {
        setBackendUrl("http://vps.example:8010");
        expect(getBackendUrl()).toBe("http://vps.example:8010");
        expect(apiBase()).toBe("http://vps.example:8010/api");
    });

    it("strips trailing slashes when storing", () => {
        setBackendUrl("http://vps.example:8010///");
        expect(getBackendUrl()).toBe("http://vps.example:8010");
        expect(apiBase()).toBe("http://vps.example:8010/api");
    });

    it("lets an explicit origin override the stored value", () => {
        setBackendUrl("http://stored:1");
        expect(apiBase("http://typed:2")).toBe("http://typed:2/api");
    });

    it("clears the configured url when set to empty", () => {
        setBackendUrl("http://vps.example:8010");
        setBackendUrl("");
        expect(getBackendUrl()).toBe("");
        expect(apiBase()).toBe("/api");
    });
});

/**
 * Tests for the photo-intake API client functions: multipart shape of
 * ai.recognize, snake_case body of items.bulkCreate, and camelization
 * of the responses. fetch is stubbed - no network.
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {ApiError, api} from "./client";

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: status < 400,
        status,
        json: () => Promise.resolve(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("api.ai.recognize", () => {
    it("POSTs multipart form data with file, container_id and container_type", async () => {
        const fetchMock = stubFetch(200, {
            provider: "anthropic",
            model: "claude-sonnet-4-6",
            items: [
                {
                    label: "Bohrmaschine",
                    category_path: "tools",
                    new_category_hint: "",
                    description: "Akku-Bohrmaschine",
                    confidence: 0.9,
                },
            ],
        });

        const photo = new Blob(["jpeg"], {type: "image/jpeg"});
        const recognition = await api.ai.recognize(photo, {
            containerId: 42,
            containerType: "box",
            fileName: "kiste.jpg",
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/ai/vision");
        expect(init.method).toBe("POST");
        expect(init.body).toBeInstanceOf(FormData);
        const formData = init.body as FormData;
        expect(formData.get("container_id")).toBe("42");
        expect(formData.get("container_type")).toBe("box");
        // happy-dom drops the append() filename argument, so only the
        // blob itself is assertable here; the name is covered by E2E.
        expect(formData.get("file")).toBeInstanceOf(Blob);
        // No manual Content-Type: the browser must set the boundary.
        expect(init.headers).toBeUndefined();

        expect(recognition.provider).toBe("anthropic");
        expect(recognition.items[0].categoryPath).toBe("tools");
        expect(recognition.items[0].newCategoryHint).toBe("");
    });

    it("omits container_type when not given", async () => {
        const fetchMock = stubFetch(200, {provider: "openai", model: "gpt-4o-mini", items: []});
        await api.ai.recognize(new Blob(["x"]), {containerId: 7});
        const formData = fetchMock.mock.calls[0][1].body as FormData;
        expect(formData.get("container_type")).toBeNull();
        expect(formData.get("file")).toBeInstanceOf(Blob);
    });

    it("throws ApiError with the backend detail on failure", async () => {
        stubFetch(400, {detail: "AI features are disabled - enable them in Settings"});
        await expect(
            api.ai.recognize(new Blob(["x"]), {containerId: 1}),
        ).rejects.toMatchObject({
            name: "ApiError",
            status: 400,
            detail: "AI features are disabled - enable them in Settings",
        });
    });
});

describe("api.items.bulkCreate", () => {
    it("snakeizes the rows and camelizes the partial-success response", async () => {
        const fetchMock = stubFetch(200, {
            created: [
                {
                    id: 1,
                    container_id: 42,
                    content: "Bohrmaschine",
                    priority: "none",
                    category_path: "tools",
                    notes: null,
                    created_at: "2026-07-09T10:00:00Z",
                    updated_at: "2026-07-09T10:00:00Z",
                },
            ],
            errors: [{index: 1, reason: "content must not be blank"}],
        });

        const bulkResult = await api.items.bulkCreate([
            {containerId: 42, content: "Bohrmaschine", categoryPath: "tools"},
            {containerId: 42, content: "", newCategoryPath: "tools/drills"},
        ]);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/items/bulk");
        const sentBody = JSON.parse(init.body as string);
        expect(sentBody.items[0]).toMatchObject({
            container_id: 42,
            category_path: "tools",
        });
        expect(sentBody.items[1]).toMatchObject({new_category_path: "tools/drills"});

        expect(bulkResult.created[0].containerId).toBe(42);
        expect(bulkResult.created[0].categoryPath).toBe("tools");
        expect(bulkResult.errors[0]).toEqual({index: 1, reason: "content must not be blank"});
    });

    it("propagates ApiError instances", async () => {
        stubFetch(422, {detail: "items list must not be empty"});
        await expect(api.items.bulkCreate([])).rejects.toBeInstanceOf(ApiError);
    });
});

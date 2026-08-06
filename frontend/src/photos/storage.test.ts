import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {db} from "../db/schema";
import {addPhoto, loadPhotos, removePhoto} from "./storage";

// Offline path: storage reads/writes Dexie directly.
vi.mock("../utils/backendStatus", () => ({
    isBackendAvailable: () => Promise.resolve(false),
}));
vi.mock("../utils/imageResize", () => ({
    downscaleImage: vi.fn(async (_file: File, edge?: number) => ({
        blob: new Blob([edge === 320 ? "thumb" : "full"], {type: "image/jpeg"}),
        fileName: "x.jpg",
        width: 1,
        height: 1,
    })),
}));

beforeEach(async () => {
    await db.photos.clear();
    (URL as unknown as {createObjectURL: unknown}).createObjectURL = vi.fn(() => "blob:fake");
    (URL as unknown as {revokeObjectURL: unknown}).revokeObjectURL = vi.fn();
});

describe("photos storage (dexie path)", () => {
    it("addPhoto stores a full + thumb blob", async () => {
        await addPhoto(5, new File(["src"], "p.jpg", {type: "image/jpeg"}));
        const rows = await db.photos.where("containerId").equals(5).toArray();
        expect(rows).toHaveLength(1);
        // fake-indexeddb does not round-trip a Blob as a Blob instance (a real
        // browser does via structured clone), so assert both derivatives were
        // stored + the row metadata rather than instanceof.
        expect(rows[0].blob).toBeTruthy();
        expect(rows[0].thumbBlob).toBeTruthy();
        expect(rows[0].mime).toBe("image/jpeg");
        expect(rows[0].containerId).toBe(5);
    });

    it("loadPhotos returns items with objectURLs to revoke", async () => {
        await addPhoto(5, new File(["s"], "p.jpg", {type: "image/jpeg"}));
        const {items, objectUrls} = await loadPhotos(5);
        expect(items).toHaveLength(1);
        expect(items[0].thumbSrc).toBe("blob:fake");
        expect(objectUrls).toHaveLength(2); // full + thumb
    });

    it("removePhoto deletes the row", async () => {
        await addPhoto(5, new File(["s"], "p.jpg", {type: "image/jpeg"}));
        const [row] = await db.photos.where("containerId").equals(5).toArray();
        await removePhoto(5, row.id as number);
        expect(await db.photos.count()).toBe(0);
    });
});

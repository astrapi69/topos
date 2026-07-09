import {afterEach, describe, expect, it, vi} from "vitest";

import {
    ImageDecodeError,
    JPEG_QUALITY,
    MAX_EDGE_PX,
    downscaleImage,
    targetDimensions,
} from "./imageResize";

interface FakeCanvas {
    width: number;
    height: number;
    getContext: () => {drawImage: ReturnType<typeof vi.fn>} | null;
    toBlob: (cb: (blob: Blob | null) => void, type?: string, quality?: number) => void;
}

function stubBitmap(width: number, height: number) {
    const close = vi.fn();
    vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockResolvedValue({width, height, close}),
    );
    return close;
}

function stubCanvas(overrides: Partial<FakeCanvas> = {}): {
    canvas: FakeCanvas;
    drawImage: ReturnType<typeof vi.fn>;
    toBlobArgs: {type?: string; quality?: number};
} {
    const drawImage = vi.fn();
    const toBlobArgs: {type?: string; quality?: number} = {};
    const canvas: FakeCanvas = {
        width: 0,
        height: 0,
        getContext: () => ({drawImage}),
        toBlob: (cb, type, quality) => {
            toBlobArgs.type = type;
            toBlobArgs.quality = quality;
            cb(new Blob(["jpeg-bytes"], {type: "image/jpeg"}));
        },
        ...overrides,
    };
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLElement);
    return {canvas, drawImage, toBlobArgs};
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("targetDimensions", () => {
    it("scales the long edge down to the max", () => {
        expect(targetDimensions(4000, 3000)).toEqual({width: MAX_EDGE_PX, height: 1176});
    });

    it("handles portrait orientation", () => {
        expect(targetDimensions(3000, 4000)).toEqual({width: 1176, height: MAX_EDGE_PX});
    });

    it("never upscales small images", () => {
        expect(targetDimensions(800, 600)).toEqual({width: 800, height: 600});
    });

    it("respects a custom max edge", () => {
        expect(targetDimensions(1000, 500, 100)).toEqual({width: 100, height: 50});
    });
});

describe("downscaleImage", () => {
    it("downscales, re-encodes as JPEG, and renames to .jpg", async () => {
        const closeBitmap = stubBitmap(4000, 3000);
        const {canvas, drawImage, toBlobArgs} = stubCanvas();

        const result = await downscaleImage(new File(["x"], "IMG_0001.PNG"));

        expect(canvas.width).toBe(MAX_EDGE_PX);
        expect(canvas.height).toBe(1176);
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_EDGE_PX, 1176);
        expect(toBlobArgs.type).toBe("image/jpeg");
        expect(toBlobArgs.quality).toBe(JPEG_QUALITY);
        expect(result.blob.type).toBe("image/jpeg");
        expect(result.fileName).toBe("IMG_0001.jpg");
        expect(result.width).toBe(MAX_EDGE_PX);
        expect(closeBitmap).toHaveBeenCalled();
    });

    it("requests EXIF-aware decoding (portrait photos must not tip over)", async () => {
        stubBitmap(100, 200);
        stubCanvas();
        const file = new File(["x"], "portrait.jpg");

        await downscaleImage(file);

        expect(createImageBitmap).toHaveBeenCalledWith(file, {imageOrientation: "from-image"});
    });

    it("falls back to photo.jpg for nameless files", async () => {
        stubBitmap(10, 10);
        stubCanvas();
        const result = await downscaleImage(new File(["x"], ""));
        expect(result.fileName).toBe("photo.jpg");
    });

    it("throws ImageDecodeError for undecodable formats (HEIC case)", async () => {
        vi.stubGlobal(
            "createImageBitmap",
            vi.fn().mockRejectedValue(new DOMException("unsupported")),
        );
        await expect(downscaleImage(new File(["x"], "photo.heic"))).rejects.toBeInstanceOf(
            ImageDecodeError,
        );
    });

    it("throws ImageDecodeError when JPEG encoding yields no blob", async () => {
        const closeBitmap = stubBitmap(100, 100);
        stubCanvas({toBlob: (cb) => cb(null)});
        await expect(downscaleImage(new File(["x"], "a.jpg"))).rejects.toBeInstanceOf(
            ImageDecodeError,
        );
        expect(closeBitmap).toHaveBeenCalled();
    });

    it("throws ImageDecodeError when the 2d context is unavailable", async () => {
        stubBitmap(100, 100);
        stubCanvas({getContext: () => null});
        await expect(downscaleImage(new File(["x"], "a.jpg"))).rejects.toBeInstanceOf(
            ImageDecodeError,
        );
    });
});

/**
 * Client-side photo downscaling for the photo-intake upload.
 *
 * Phone cameras produce 5-15 MB photos; the vision models neither need
 * nor want that resolution. Downscaling to a ~1568px long edge before
 * the upload keeps mobile uploads fast and the backend body-size
 * middleware happy. EXIF orientation is honored via
 * `createImageBitmap(file, {imageOrientation: "from-image"})` so
 * portrait shots do not arrive rotated.
 *
 * Formats the browser cannot decode (e.g. HEIC on most non-Safari
 * browsers) reject with `ImageDecodeError` so the page can show a
 * clear message instead of a generic failure.
 *
 * @example
 * const photo = await downscaleImage(inputFile);
 * formData.append("file", photo.blob, photo.fileName);
 */

/** Long-edge target in px; matches what vision APIs downscale to anyway. */
export const MAX_EDGE_PX = 1568;
/** JPEG quality for the re-encode; ~0.75 keeps text on labels legible. */
export const JPEG_QUALITY = 0.75;

/** Thrown when the browser cannot decode or re-encode the picked file. */
export class ImageDecodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImageDecodeError";
    }
}

export interface DownscaledImage {
    blob: Blob;
    fileName: string;
    width: number;
    height: number;
}

/**
 * Compute the downscaled dimensions for a `maxEdge` long-edge target.
 * Never upscales: images already small enough keep their size.
 */
export function targetDimensions(
    width: number,
    height: number,
    maxEdge: number = MAX_EDGE_PX,
): {width: number; height: number} {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

/**
 * Downscale + re-encode a picked image file to an upload-friendly JPEG.
 *
 * @param file - The camera capture or picked file.
 * @param maxEdge - Long-edge target in px (default {@link MAX_EDGE_PX}).
 * @param quality - JPEG quality in (0, 1] (default {@link JPEG_QUALITY}).
 * @throws {ImageDecodeError} When decoding or JPEG encoding fails
 *   (undecodable format such as HEIC, or no canvas 2d context).
 */
export async function downscaleImage(
    file: File,
    maxEdge: number = MAX_EDGE_PX,
    quality: number = JPEG_QUALITY,
): Promise<DownscaledImage> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, {imageOrientation: "from-image"});
    } catch {
        throw new ImageDecodeError(`cannot decode image ${file.name || "(unnamed)"}`);
    }
    try {
        const {width, height} = targetDimensions(bitmap.width, bitmap.height, maxEdge);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new ImageDecodeError("canvas 2d context unavailable");
        }
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (!blob) {
            throw new ImageDecodeError("JPEG encoding failed");
        }
        const baseName = (file.name || "photo").replace(/\.[^.]*$/, "") || "photo";
        return {blob, fileName: `${baseName}.jpg`, width, height};
    } finally {
        bitmap.close();
    }
}

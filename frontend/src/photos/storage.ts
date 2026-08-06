/**
 * Container photo storage, dual-mode (auto-selected by isBackendAvailable()).
 *
 * Backend mode: files on the server (existing /api/containers/{id}/photos
 * endpoints); <img> src is the backend URL. Offline/PWA mode: blobs in Dexie;
 * <img> src is a createObjectURL (revoked by the hook).
 *
 * Both modes share ONE image pipeline: the client always downscales to a full
 * JPEG (~1568px long edge) + a thumbnail (~320px) via Canvas (utils/imageResize),
 * which also strips EXIF. The backend just stores the bytes.
 */

import {api} from "../api/client";
import {apiBase} from "../api/baseUrl";
import {db} from "../db/schema";
import {isBackendAvailable} from "../utils/backendStatus";
import {downscaleImage} from "../utils/imageResize";
import type {ContainerPhotoItem, LoadedPhotos} from "./types";

const THUMB_EDGE = 320;

export async function loadPhotos(containerId: number): Promise<LoadedPhotos> {
    if (await isBackendAvailable()) {
        const rows = await api.photos.list(containerId);
        const base = apiBase();
        return {
            items: rows.map((row) => ({
                id: row.id,
                mime: row.mime,
                thumbSrc: `${base}${row.thumbUrl}`,
                fullSrc: `${base}${row.fullUrl}`,
            })),
            objectUrls: [],
        };
    }
    const rows = await db.photos.where("containerId").equals(containerId).sortBy("id");
    const objectUrls: string[] = [];
    const items: ContainerPhotoItem[] = rows.map((row) => {
        const thumbSrc = URL.createObjectURL(row.thumbBlob);
        const fullSrc = URL.createObjectURL(row.blob);
        objectUrls.push(thumbSrc, fullSrc);
        return {id: row.id as number, mime: row.mime, thumbSrc, fullSrc};
    });
    return {items, objectUrls};
}

export async function addPhoto(containerId: number, file: File): Promise<void> {
    const full = await downscaleImage(file);
    const thumb = await downscaleImage(file, THUMB_EDGE);
    if (await isBackendAvailable()) {
        await api.photos.upload(containerId, full.blob, thumb.blob);
    } else {
        await db.photos.add({
            containerId,
            blob: full.blob,
            thumbBlob: thumb.blob,
            mime: "image/jpeg",
            createdAt: new Date().toISOString(),
        });
    }
}

export async function removePhoto(containerId: number, photoId: number): Promise<void> {
    if (await isBackendAvailable()) {
        await api.photos.remove(containerId, photoId);
    } else {
        await db.photos.delete(photoId);
    }
}

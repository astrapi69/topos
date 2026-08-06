/** A container photo ready to render (src is a backend URL or a Dexie objectURL). */
export interface ContainerPhotoItem {
    id: number;
    thumbSrc: string;
    fullSrc: string;
    mime: string;
}

export interface LoadedPhotos {
    items: ContainerPhotoItem[];
    /** ObjectURLs to revoke when the set is replaced (Dexie mode only). */
    objectUrls: string[];
}

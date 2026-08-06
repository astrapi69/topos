import { useCallback, useEffect, useRef, useState } from "react";

import { loadPhotos } from "./storage";
import type { ContainerPhotoItem } from "./types";

/**
 * Load a container's photos and manage the objectURL lifecycle: URLs created
 * for Dexie blobs are revoked when the set is replaced or the component
 * unmounts, so a busy thumbnail grid does not leak memory.
 */
export function useContainerPhotos(containerId: number | null) {
  const [items, setItems] = useState<ContainerPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const urlsRef = useRef<string[]>([]);

  const revokeAll = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  };

  const refresh = useCallback(async () => {
    if (containerId === null) {
      setLoading(false);
      return;
    }
    const { items: loaded, objectUrls } = await loadPhotos(containerId);
    revokeAll();
    urlsRef.current = objectUrls;
    setItems(loaded);
    setLoading(false);
  }, [containerId]);

  useEffect(() => {
    void refresh();
    return revokeAll;
  }, [refresh]);

  return { items, loading, refresh };
}

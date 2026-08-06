/**
 * Container photo attachments: thumbnail grid + upload (camera / gallery) +
 * delete + lightbox. Dual-mode storage (backend files vs Dexie blobs) is
 * handled in src/photos/; this component is UI only.
 */

import { useRef, useState } from "react";

import { Camera, ImagePlus, Trash2 } from "lucide-react";

import PhotoLightbox from "./PhotoLightbox";
import { useI18n } from "../hooks/useI18n";
import { useDialog } from "./AppDialog";
import { addPhoto, removePhoto, useContainerPhotos } from "../photos";
import { notify, errorMessage } from "../utils/notify";
import { btn, muted } from "../ui/classes";

export default function ContainerPhotos({
  containerId,
}: {
  containerId: number;
}) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const { items, refresh } = useContainerPhotos(containerId);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  async function onFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        await addPhoto(containerId, file);
      }
      await refresh();
      notify.success(
        t(
          "topos.page.container_detail.photos_added",
          "{count} Foto(s) hinzugefügt",
        ).replace("{count}", String(files.length)),
      );
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t(
            "topos.page.container_detail.photos_add_failed",
            "Foto konnte nicht hinzugefügt werden",
          ),
        ),
        err,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photoId: number) {
    const ok = await confirm(
      t("topos.page.container_detail.photos_delete_title", "Foto löschen?"),
      t(
        "topos.page.container_detail.photos_delete_message",
        "Dieses Foto wird dauerhaft gelöscht.",
      ),
      "danger",
    );
    if (!ok) return;
    try {
      await removePhoto(containerId, photoId);
      await refresh();
    } catch (err) {
      notify.error(
        errorMessage(
          err,
          t(
            "topos.page.container_detail.photos_delete_failed",
            "Foto konnte nicht gelöscht werden",
          ),
        ),
        err,
      );
    }
  }

  return (
    <section style={{ marginTop: "1.5rem" }} data-testid="container-photos">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h2>{t("topos.page.container_detail.photos_title", "Fotos")}</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={btn}
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            data-testid="container-photos-camera"
          >
            <Camera size={16} aria-hidden />
            {t("topos.page.container_detail.photos_camera", "Kamera")}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => galleryRef.current?.click()}
            disabled={busy}
            data-testid="container-photos-add"
          >
            <ImagePlus size={16} aria-hidden />
            {t("topos.page.container_detail.photos_add", "Fotos hinzufügen")}
          </button>
          {/* Camera: single shot straight from the device camera. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onFilesPicked}
            data-testid="container-photos-camera-input"
          />
          {/* Gallery: multi-select from the photo library. */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onFilesPicked}
            data-testid="container-photos-input"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className={muted}>
          {t("topos.page.container_detail.photos_empty", "Noch keine Fotos.")}
        </p>
      ) : (
        <ul
          className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4"
          style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}
        >
          {items.map((photo, i) => (
            <li
              key={photo.id}
              className="relative"
              data-testid={`container-photo-${photo.id}`}
            >
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="block w-full"
                aria-label={t(
                  "topos.page.container_detail.photos_open",
                  "Foto öffnen",
                )}
              >
                <img
                  src={photo.thumbSrc}
                  alt=""
                  className="aspect-square w-full rounded border border-line object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                aria-label={t("topos.common.delete", "Löschen")}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded border border-line bg-surface text-danger hover:bg-surface-hover"
                data-testid={`container-photo-delete-${photo.id}`}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox !== null && (
        <PhotoLightbox
          items={items}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          closeLabel={t("topos.common.cancel", "Schließen")}
        />
      )}
    </section>
  );
}

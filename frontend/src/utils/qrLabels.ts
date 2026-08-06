/**
 * Localized control labels for QrCodeModal, built from Topos i18n. Shared by
 * the container share button and the About-section app-share button so the
 * modal's copy stays consistent.
 */

import type {QrCodeModalLabels} from "../components/QrCodeModal";

export function qrLabels(t: (key: string, fallback?: string) => string): QrCodeModalLabels {
    return {
        close: t("topos.qr.close", "Schließen"),
        copy: t("topos.qr.copy", "URL kopieren"),
        copied: t("topos.qr.copied", "Kopiert"),
        download: t("topos.qr.download", "Herunterladen"),
        share: t("topos.qr.share", "Teilen"),
        imageAlt: t("topos.qr.alt", "QR-Code"),
    };
}

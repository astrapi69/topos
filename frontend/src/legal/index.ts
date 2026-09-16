/**
 * Imprint and privacy policy: content per language.
 *
 * The texts exist in German and English; every other UI language falls
 * back to English (short UI labels around them stay translated through
 * the i18n catalogs). The German version is the one the operator reads,
 * the English version mirrors it paragraph by paragraph.
 */
import { imprintDe } from "./imprint.de";
import { imprintEn } from "./imprint.en";
import { privacyDe } from "./privacy.de";
import { privacyEn } from "./privacy.en";
import type { LegalDocument, LegalKind, LegalLocale } from "./types";

export type { LegalDocument, LegalKind, LegalLocale } from "./types";

export const LEGAL_KINDS = ["imprint", "privacy"] as const;
export const LEGAL_LOCALES = ["de", "en"] as const;

const DOCUMENTS: Record<LegalKind, Record<LegalLocale, LegalDocument>> = {
  imprint: { de: imprintDe, en: imprintEn },
  privacy: { de: privacyDe, en: privacyEn },
};

/** German for any German variant, English for everything else. */
export function pickLegalLocale(lang: string): LegalLocale {
  return lang.toLowerCase().startsWith("de") ? "de" : "en";
}

export function getLegalDocument(
  kind: LegalKind,
  locale: LegalLocale,
): LegalDocument {
  return DOCUMENTS[kind][locale];
}

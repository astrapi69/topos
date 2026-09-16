/**
 * Shell for the imprint and the privacy policy: NavBar, narrow column,
 * title, "last updated" line and the localized body.
 */
import NavBar from "./NavBar";
import { useI18n } from "../hooks/useI18n";
import { getLegalDocument, pickLegalLocale, type LegalKind } from "../legal";
import { muted, pageMainNarrow } from "../ui/classes";

function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang || undefined, {
      dateStyle: "long",
    }).format(new Date(`${iso}T00:00:00`));
  } catch {
    return iso;
  }
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const { t, lang } = useI18n();
  const locale = pickLegalLocale(lang);
  const fellBack = locale === "en" && !lang.toLowerCase().startsWith("en");
  const doc = getLegalDocument(kind, locale);

  return (
    <>
      <NavBar />
      <main className={pageMainNarrow}>
        <article data-testid={`legal-${kind}`} lang={locale}>
          <h1 data-testid={`legal-${kind}-title`}>{doc.title}</h1>
          <p
            className={`${muted} text-sm`}
            data-testid={`legal-${kind}-updated`}
          >
            {t("topos.legal.updated", "Stand")}:{" "}
            {formatDate(doc.updated, locale)}
          </p>
          {fellBack && (
            <p className={`${muted} text-sm`} data-testid="legal-fallback-hint">
              {t(
                "topos.legal.fallback_hint",
                "Dieser Text ist nur auf Deutsch und Englisch verfügbar.",
              )}
            </p>
          )}
          <doc.Content />
        </article>
      </main>
    </>
  );
}

/**
 * The two legal links under every route, so the imprint and the privacy
 * policy are one click away from any screen of the public web app. The
 * targets are static HTML files outside the SPA (see
 * `legal/legalPages.ts`), opened in the same tab.
 */
import { useI18n } from "../hooks/useI18n";
import { legalPageHref } from "../legal/legalPages";
import { link, muted } from "../ui/classes";

const LINK_CLASS = `${link} inline-flex min-h-[44px] items-center px-2`;

export default function LegalFooter() {
  const { t, lang } = useI18n();
  return (
    <footer
      data-testid="legal-footer"
      aria-label={t("topos.legal.footer_aria", "Rechtliches")}
      className={`${muted} mt-8 flex flex-wrap items-center justify-center gap-1 px-4 py-2 text-sm`}
    >
      <a
        href={legalPageHref("imprint", lang)}
        data-testid="legal-footer-imprint"
        className={LINK_CLASS}
      >
        {t("topos.legal.imprint", "Impressum")}
      </a>
      <span aria-hidden>·</span>
      <a
        href={legalPageHref("privacy", lang)}
        data-testid="legal-footer-privacy"
        className={LINK_CLASS}
      >
        {t("topos.legal.privacy", "Datenschutzerklärung")}
      </a>
    </footer>
  );
}

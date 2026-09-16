/**
 * Legal links under every page. The public PWA is an online service and
 * has to name its operator and its data handling from anywhere; the
 * footer is the one place that exists on every route without touching
 * the NavBar's layout.
 */
import { Link } from "react-router-dom";

import { useI18n } from "../hooks/useI18n";
import { link, muted } from "../ui/classes";

export default function AppFooter() {
  const { t } = useI18n();
  return (
    <footer
      data-testid="app-footer"
      aria-label={t("topos.legal.footer_aria", "Rechtliches")}
      className={`${muted} mt-8 px-4 py-4 text-center text-sm`}
    >
      <Link className={link} to="/impressum" data-testid="footer-imprint-link">
        {t("topos.legal.imprint", "Impressum")}
      </Link>
      <span aria-hidden className="mx-2">
        ·
      </span>
      <Link
        className={link}
        to="/datenschutz"
        data-testid="footer-privacy-link"
      >
        {t("topos.legal.privacy_short", "Datenschutz")}
      </Link>
    </footer>
  );
}

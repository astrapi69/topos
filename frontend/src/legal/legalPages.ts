/**
 * Paths of the static legal pages (imprint and privacy policy).
 *
 * The pages are plain HTML files in `public/`, so they exist in every
 * deployment at the deploy base (`/topos/impressum.html` on GitHub
 * Pages, `/impressum.html` on a root deployment) and stay reachable
 * without the app bundle. German UI languages get the German pages,
 * every other language the English ones. Same shape as bibliogon's
 * `lib/utils/legal/legalPages.ts`.
 *
 * No app imports, so the footer, the About section and tests share it.
 *
 * @example
 * legalPageHref("privacy", "de", "/topos/"); // "/topos/datenschutz.html"
 */

export type LegalPage = "imprint" | "privacy";

const PATHS: Record<"de" | "en", Record<LegalPage, string>> = {
  de: { imprint: "impressum.html", privacy: "datenschutz.html" },
  en: { imprint: "imprint.html", privacy: "privacy.html" },
};

/** File name of the page for a UI language (`de` or any regional variant: German). */
export function legalPagePath(page: LegalPage, lang: string): string {
  const isGerman = lang.toLowerCase().split("-")[0] === "de";
  return PATHS[isGerman ? "de" : "en"][page];
}

/** Absolute href under the deploy base (defaults to Vite's `BASE_URL`). */
export function legalPageHref(
  page: LegalPage,
  lang: string,
  base: string = import.meta.env.BASE_URL,
): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${legalPagePath(page, lang)}`;
}

/**
 * Public share URLs, built from the deployment the app is actually served
 * from (origin + Vite base path). Printing labels from the GitHub Pages PWA
 * yields astrapi69.github.io/topos/... URLs; printing from a self-hosted
 * Docker instance yields that host's URLs - each correct for its deployment.
 */

/** Origin + base path, always ending with a slash (e.g. https://host/topos/). */
function appBase(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = import.meta.env.BASE_URL || "/";
    return `${origin}${base}`;
}

/** Public URL of the app itself (for the About-section share QR). */
export function appShareUrl(): string {
    return appBase();
}

/** Public URL of a container's detail page (the QR target on a label). */
export function containerShareUrl(id: number): string {
    return `${appBase()}containers/${id}`;
}

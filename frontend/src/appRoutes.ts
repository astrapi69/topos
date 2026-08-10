/**
 * Static app routes, shared between the router and the build.
 *
 * GitHub Pages has no SPA rewrite. A deep link like `/topos/settings`
 * is an unknown path, so Pages answers with `404.html` - the app shell
 * loads and React Router resolves the route, but the HTTP status stays
 * 404. That costs an SEO audit ("unsuccessful HTTP status code"), makes
 * Lighthouse report the page as unreliable to load, and logs a console
 * error on every deep-link visit.
 *
 * Emitting `dist/<route>/index.html` for each static route makes Pages
 * serve a real 200 for those URLs. Parameterised routes
 * (`/containers/:id`, `/items/:id`) cannot be enumerated at build time
 * and keep relying on the `404.html` fallback.
 *
 * Kept in sync with `App.tsx` by `appRoutes.test.ts`.
 */
export const STATIC_ROUTES = [
  "/",
  "/containers",
  "/items/new",
  "/categories",
  "/actions",
  "/import",
  "/photo-intake",
  "/settings",
] as const;

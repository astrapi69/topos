# External hosts in the GitHub Pages build (2026-09-16)

Issue: [#12](https://github.com/astrapi69/topos/issues/12). Scope: what the
public PWA at https://astrapi69.github.io/topos/ references and contacts
outside its own origin. Basis for the privacy policy and for the guard that
keeps this table true.

## Method

1. Build the artifact users get:
   `cd frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build`.
2. Static scan of every text asset in `dist/` (HTML incl. the prerendered
   route copies and `404.html`, JS, CSS, JSON, `manifest.webmanifest`,
   `sw.js` + workbox, `sitemap.xml`, `robots.txt`, SVG) for absolute or
   protocol-relative URLs, plus every `<script>`, `<link>`, `<img>`,
   `<iframe>` and connection-hint tag. Code: `frontend/src/artifact/externalHosts.ts`.
3. Runtime capture: `e2e/tools/capture-external-requests.mjs` drives the
   served build through first load, all eight static routes, every
   Settings tab, the update check, PhotoIntake without a key, and a reload
   with the service worker active, recording requests at browser-context
   level so service-worker fetches count.

Build facts: 0 sourcemaps in `dist/` (`build.sourcemap` unset), 76
precache entries, fonts self-hosted under `fonts/` (JetBrains Mono, DM
Sans, Inter, Crimson Pro, Lora; licenses in `frontend/public/fonts/LICENSES.md`),
no `preconnect` / `dns-prefetch`, no third-party tag in any HTML file.

## Static scan: hosts referenced by the bundle

| Host | Purpose | Triggered by | Automatic? | Avoidable? |
|---|---|---|---|---|
| astrapi69.github.io | own origin: canonical, Open Graph, sitemap, robots | page view | yes (it is the host) | n/a |
| api.anthropic.com | Anthropic Messages API: photo recognition, key probe | Recognize / Test connection with the user's own key | no | no (the feature) |
| api.openai.com | OpenAI chat completions (CORS-blocked in the browser build; backend only) | same | no | no |
| generativelanguage.googleapis.com | Google Gemini generateContent | same | no | no |
| api.perplexity.ai | Perplexity chat completions | same | no | no |
| github.com | repo, license, "Report issue" links (About); author URL in JSON-LD; exceljs upgrade note in an error string | user click | no | no (links) |
| liberapay.com | donation link (About) | user click | no | no |
| ko-fi.com | donation link (About) | user click | no | no |
| opensource.org | MIT license URL in JSON-LD | never fetched by the app | no | n/a |
| schema.org | JSON-LD `@context` | never fetched | no | n/a (identifier) |
| www.w3.org | SVG / XHTML namespaces | never fetched | no | n/a |
| purl.org, schemas.microsoft.com, schemas.openxmlformats.org | Office Open XML namespaces exceljs writes into workbooks | never fetched | no | n/a |
| www.sitemaps.org | sitemap namespace | never fetched | no | n/a |
| bit.ly, react.dev, reactrouter.com, rolldown.rs, radix-ui.com, stuk.github.io, tinyurl.com | documentation URLs inside library error messages | never fetched | no | n/a |

Nothing in the table is loaded on page view. Nothing is left to self-host.

## Runtime capture

| Metric | Value |
|---|---|
| Requests recorded | 273 |
| Same-origin | 273 |
| External | 0 |
| Service-worker initiated | 70 |

Steps covered: `/`, `/containers`, `/items/new`, `/categories`, `/actions`,
`/import`, `/photo-intake`, `/settings`, all Settings tabs (general, ai,
data, maintenance, about), update check (one request: `version.json`,
same origin), PhotoIntake Recognize without a key (no provider call),
reload with the service worker installed.

## Guard

- `frontend/external-hosts.allowlist.json`: every host above with
  category, purpose and trigger.
- `frontend/src/artifact/externalHosts.dist.test.ts`: fails on any host
  outside the allowlist, on any third-party loading tag or connection hint
  in HTML, and on any allowlist entry the build no longer references.
  Skips without `dist/`; `TOPOS_REQUIRE_DIST=1` makes a missing build a
  failure.
- CI: `ci.yml` (frontend job) builds the Pages variant and runs the guard
  on every PR; `deploy-gh-pages.yml` re-runs it on the bytes that go live.

## Reproduce

```bash
cd frontend && GITHUB_PAGES=true VITE_STORAGE_MODE=dexie bun run build
TOPOS_REQUIRE_DIST=1 bunx vitest run src/artifact/externalHosts.dist.test.ts
mkdir -p /tmp/serve && ln -sfn "$PWD/dist" /tmp/serve/topos
(cd /tmp/serve && python3 -m http.server 4174 --bind 127.0.0.1 &)
cd ../e2e && AUDIT_BASE=http://127.0.0.1:4174/topos/ node tools/capture-external-requests.mjs
```

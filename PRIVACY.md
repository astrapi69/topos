# Privacy: what leaves the device and what stays on it

Technical inventory for Topos, kept next to [SECURITY.md](SECURITY.md) and
reviewed with the code that changes it. It is not the legal privacy policy:
the policy the public PWA shows to its users is derived from this file
(issue #15). Measured on 2026-09-16, see
[docs/audit/2026-09-16-external-hosts.md](docs/audit/2026-09-16-external-hosts.md).
The host guard (`frontend/external-hosts.allowlist.json`, checked by
`frontend/src/artifact/externalHosts.dist.test.ts`) turns the build red when
the bundle starts referencing a host not documented here.

## Deployments

| Deployment | Data lives in | Network partner |
|---|---|---|
| Browser build on GitHub Pages (https://astrapi69.github.io/topos/, `VITE_STORAGE_MODE=dexie`) | the browser: IndexedDB, `localStorage`, service-worker cache | GitHub Pages serves the files. Nothing else on page view. |
| Self-hosted backend (`make dev`, Docker) | the backend's data directory (SQLite, uploads) on the machine that runs it | the backend you run; the browser talks only to it |
| Desktop launcher (PyInstaller) | as self-hosted: the launcher runs the backend locally in Docker | the local backend, plus one GitHub API call for the update check |

## What leaves the device

Per item: what triggers it (automatic or an explicit user action), what is
sent, to whom, and how to prevent it.

### AI photo recognition (PhotoIntake)

- **Trigger:** explicit. Take or choose a photo, then "Erkennen".
- **Content:** the photo, downscaled in the browser to at most 1568 px on the
  long edge and re-encoded as JPEG at quality 0.75
  (`frontend/src/utils/imageResize.ts`), sent base64-encoded; a text prompt
  with the container type (folder or box) and a token-limited selection of
  your existing category paths (`frontend/src/ai/visionPrompt.ts`); the
  model name.
- **Recipient:** the provider you chose, under that provider's terms:
  Anthropic (`api.anthropic.com`), OpenAI (`api.openai.com`), Google Gemini
  (`generativelanguage.googleapis.com`), Perplexity (`api.perplexity.ai`).
- **Path:** the browser build calls the provider directly from your browser
  with the key from your local vault (`frontend/src/ai/browserAiClient.ts`).
  OpenAI does not allow browser calls (CORS) and is available only with a
  backend. With a backend, the browser sends the photo to your backend
  (`POST /api/ai/vision`) and the backend calls the provider with the key
  from its configuration (`backend/app/ai/`).
- **Off:** store no key, switch AI off in Settings > AI (the vault's
  `enabled` flag), or keep the vault locked. Nothing is sent without a
  stored key and an unlocked vault.

### AI connection test

- **Trigger:** explicit. "Test" in Settings > AI.
- **Content:** one request to the provider's models endpoint that carries
  the API key and nothing else (Gemini takes the key as a query parameter).
  No inventory data.
- **Recipient and off:** as above.

### Backend mode

- **Trigger:** automatic once a backend is present: `make dev`, Docker, the
  launcher, or a URL entered under Settings > Backend (stored as
  `topos.backend_url`).
- **Content:** everything the app does: containers, items, categories,
  actions, photos (uploaded to `/api/containers/{id}/photos`, stored in the
  backend's upload directory), backups, settings. Plus one `GET /api/health`
  probe per page load to detect the backend
  (`frontend/src/utils/backendStatus.ts`) and one when you save a backend
  URL.
- **Recipient:** the backend you run. Its web server logs requests (client
  IP, path, time) on that machine, as any web server does.
- **Off:** use the browser build without a backend, or remove the URL under
  Settings > Backend.

### Error report

- **Trigger:** explicit. An error toast offers a report; the dialog shows
  the full text first; "Report on GitHub" opens
  `https://github.com/astrapi69/topos/issues/new` in a new tab with the
  report prefilled (`frontend/src/components/ErrorReportDialog.tsx`).
- **Content:** error message and status, the first 800 characters of a
  stack trace when the backend sent one, browser user agent, app version,
  and whatever you typed as reproduction steps. Trimmed to GitHub's URL
  length limit.
- **Recipient:** GitHub, and only once you submit the issue there with your
  GitHub account. "Copy" puts the same text on your clipboard instead.
- **Off:** do not click. Nothing is sent automatically.

### Update check

- **Trigger:** automatic per visit for the service worker: the browser
  re-fetches `sw.js` from the origin and swaps in a new build without
  asking (`registerType: "autoUpdate"` in `frontend/vite.config.ts`). The
  version check fetches `version.json` from the same origin when
  Settings > About is shown and when you click "Check for updates"
  (`frontend/src/pwa/update-store.ts`).
- **Recipient:** the origin that serves the app (GitHub Pages or your
  backend). No third party.
- **Off:** not separately; it is part of loading the app from its host.

### External links

- **Trigger:** explicit click. Repository, MIT license and "Report issue"
  (github.com), donations (liberapay.com, ko-fi.com) in Settings > About.
  They open in a new tab; the app sends nothing itself.

### Desktop launcher

- **Trigger:** automatic at launcher start unless switched off:
  `GET https://api.github.com/repos/astrapi69/topos/releases/latest` with a
  5 s timeout, to compare version tags
  (`launcher/topos_launcher/update_check.py`). Content: nothing beyond the
  request itself; GitHub sees your IP address and user agent.
- **Off:** uncheck the auto-update option in the launcher's settings dialog,
  choose "Don't check for updates" in the update prompt, or set
  `"auto_update_check": false` in `<user config dir>/topos/settings.json`.
- **Installation and updates:** the launcher and `install.sh` clone or
  download the release from github.com and build the Docker images, which
  pulls the base images named in the Dockerfiles from Docker Hub.

### Explicitly not present

No analytics, no telemetry, no crash reporting, no cookies, no fonts or
scripts from CDNs, no translation service, no git push from the app, no
account, no server-side storage by the project. The public build contacts
nothing on page view except its own origin: 273 requests recorded across
every route, every Settings tab, the update check, PhotoIntake without a
key and a reload with the service worker active, 0 of them external.

## What stays on the device

### Browser (both builds)

| Store | Content | Written when | Delete |
|---|---|---|---|
| IndexedDB database `topos`, tables `containers`, `items`, `categories`, `actions` (`frontend/src/db/schema.ts`) | your inventory. Browser build: the primary store. Backend mode: a read-through cache of the backend's data | on every change and every load | Settings > Maintenance "Reset cache" clears these four tables (in the browser build that deletes your data, #16); or the browser's site data for the origin |
| IndexedDB table `photos` | container photos as image blobs (browser build only; with a backend photos go to the backend) | when you attach a photo | delete the photo on the container, or site data. Not part of "Reset cache", not part of the backup file (#17) |
| `localStorage` `topos.ai_vault` | the AI key vault: your API keys as a PBKDF2 + AES-GCM envelope under your passphrase, plus a plaintext metadata mirror (AI on/off, active provider, model and base-URL overrides, which providers have a key). No key material in plaintext (`frontend/src/ai/localVaultStore.ts`) | when you save a key or an AI setting | remove the keys in Settings > AI, or site data |
| `localStorage` `topos.storage_mode` | `api` or `dexie` | when the mode is switched | site data |
| `localStorage` `topos.backend_url` | the backend URL you entered | Settings > Backend | Settings > Backend, or site data |
| `localStorage` `topos.lang` | UI language | language switch | site data |
| `localStorage` `topos-theme`, `topos-app-theme` | light/dark and palette | theme switch | site data |
| `localStorage` `topos.container_types` | your custom container types | Settings | site data |
| `localStorage` `topos.install_dismissed`, `topos.ios_install_dismissed` | that you dismissed the install banner | dismiss | site data |
| Cache Storage (service worker, workbox) | the app shell (JS, CSS, HTML, fonts, icons) for offline start; the exceljs chunk after first use; in backend mode the last `GET /api/...` responses, i.e. inventory data (`runtimeCaching` in `frontend/vite.config.ts`) | first visit, then on use | site data, or unregister the service worker in the browser's developer tools |
| memory only | the vault passphrase and the decrypted keys while unlocked | unlock | reload the page, or lock the vault |

"Site data" is the browser's own control for the origin
(`astrapi69.github.io`, or your backend's host): it deletes IndexedDB,
`localStorage`, caches and the service worker at once. Export a backup
first: Settings > Data writes `topos-backup-YYYY-MM-DD.topos.json` with
containers, items, categories and actions (photos are not included, #17).

### Self-hosted backend and launcher

- **Data directory:** `~/.local/share/topos/` (Linux, macOS),
  `%LOCALAPPDATA%\topos\` (Windows), `/app/data` in Docker (named volume
  `topos-data`): SQLite database, uploaded photos, backup history, user
  config overlay (`backend/app/paths.py`, `docs/configuration.md`).
  `TOPOS_DATA_DIR` overrides it.
- **Secrets:** `~/.config/topos/secrets.yaml` (AI provider keys for
  backend mode, file mode 0600), or environment variables.
- **Launcher settings:** `<user config dir>/topos/settings.json`.
- **Delete:** `uninstall.sh` removes the Docker stack, the `topos` Docker
  volumes, the images and the install directory. A data directory of a
  non-Docker run (`make dev`) and the secrets file are yours to delete.

## Open findings

- #16 "Reset cache" in the browser build deletes the primary store while
  the confirmation says the data reloads from the server.
- #17 the backup file does not include photos.
- #18 `install.sh.template` and `uninstall.sh` still print
  "Adaptive Learner".

## Keeping this file true

- `frontend/external-hosts.allowlist.json` with
  `frontend/src/artifact/externalHosts.dist.test.ts`: red when the built
  bundle references a host not listed, or loads anything from a third party
  on page view. Runs in PR CI and before every Pages deploy.
- `e2e/tools/capture-external-requests.mjs`: re-measures the runtime
  behaviour of the served build.
- A change to a network call or to a store updates this file in the same
  pull request.

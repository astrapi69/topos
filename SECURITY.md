# Security Policy

## Supported Versions

Topos is pre-1.0 software. Only the latest minor version receives
security fixes. Users on older versions should upgrade to the
latest release.

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub's
**Private Vulnerability Reporting** feature:

1. Navigate to https://github.com/astrapi69/topos/security
2. Click "Report a vulnerability"
3. Provide a clear description, reproduction steps, and an
   impact assessment

We aim to acknowledge reports within 7 days and provide a
fix or mitigation timeline within 14 days for confirmed
vulnerabilities.

Please do **not** open a public GitHub Issue for security
reports. Public Issues for non-security bugs remain the right
channel.

## Scope notes

Topos runs in two deployments with different surfaces, and both
are in scope:

- **Offline PWA (GitHub Pages)**: all data lives in the browser
  (IndexedDB). Of particular interest: the passphrase-encrypted
  AI key vault (keys must never reach localStorage in plaintext),
  the Excel/JSON import paths (crafted workbooks or backup files),
  and anything that could exfiltrate inventory data.
- **Self-hosted backend (Docker)**: FastAPI + SQLite on the
  user's own machine. Of particular interest: the workbook and
  backup upload endpoints, plugin ZIP installation (name
  validation, path traversal), and secrets handling
  (`~/.config/topos/secrets.yaml`, env-var chain - secrets must
  never land in committed config or logs).

## Out of Scope

- Issues that require physical access to the user's machine
- Issues in third-party dependencies that have not been
  reported upstream first
- Issues in user-provided plugins not maintained by the
  Topos project
- The AI providers' own APIs (Anthropic, OpenAI, Google,
  Perplexity) - report those upstream; Topos-side key handling
  IS in scope

## Disclosure Policy

We follow coordinated disclosure: a vulnerability is publicly
disclosed only after a fix is available, typically as part of
the next patch release with a security note in the CHANGELOG.

## Acknowledgments

Reporters who follow this process receive credit in the
release notes unless they prefer to remain anonymous.

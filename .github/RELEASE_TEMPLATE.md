# Topos vX.Y.Z

> **Static reference template.** Copy the relevant sections into
> `changelog/releases/vX.Y.Z.md` before invoking
> `gh release create --notes-file ...` (release-workflow.md Step 8).
> No automation reads this file; it exists so every release reuses
> the same prerequisites + verification block instead of being
> rewritten from memory.

## Before you install

Topos runs in Docker. You need Docker Desktop installed and running before starting the launcher.

- [Docker installation guide (English)](https://github.com/astrapi69/pluginforge-app-template/blob/main/docs/help/en/install/docker-desktop.md) - includes a "Is Docker safe to install?" section
- [Docker-Installationsanleitung (Deutsch)](https://github.com/astrapi69/pluginforge-app-template/blob/main/docs/help/de/install/docker-desktop.md) - mit Abschnitt "Ist Docker sicher zu installieren?"

The launcher detects Docker, downloads Topos automatically, and opens it in your browser. The first launch takes 5-10 minutes (Docker images build, ~2 GB disk space).

## Download

| Platform | File |
|----------|------|
| Windows | `topos-launcher.exe` |
| macOS (Apple silicon) | `topos-launcher-macos.zip` |
| Linux | `topos-launcher` (ELF binary) |

Each platform also ships a `*.sha256` checksum next to the binary.

## Running it on Linux and macOS

GitHub release assets carry no executable bit, so the Linux binary needs
one before it will start:

```bash
chmod +x topos-launcher
./topos-launcher --version   # prints the version, starts nothing
./topos-launcher             # starts Topos
```

On macOS the app is unsigned: open `topos-launcher-macos.zip`, then
right-click "Topos Launcher.app" and choose Open once to get past
Gatekeeper. Double-clicking the first time shows a refusal instead.

## Verifying downloads

```bash
# Linux
shasum -a 256 topos-launcher
cat topos-launcher.sha256

# macOS
shasum -a 256 topos-launcher-macos.zip
cat topos-launcher-macos.zip.sha256
```

```powershell
# Windows
Get-FileHash -Algorithm SHA256 .\topos-launcher.exe
Get-Content .\topos-launcher.exe.sha256
```

The hashes must match.

If your operating system warns about an unsigned binary, see the [Topos installation overview](https://github.com/astrapi69/pluginforge-app-template/blob/main/docs/help/en/installation.md).

## What's new

<!-- Paste the per-version changelog excerpt here. Keep the
"Before you install", "Download", and "Verifying downloads"
sections above unchanged across releases; only the changelog
varies. -->

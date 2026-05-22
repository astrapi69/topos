# Uninstalling Topos

There are two ways to uninstall Topos, depending on how you installed it.

## Path A: Launcher (all platforms)

If you installed Topos using one of the launchers ([Windows](launcher-windows.md), [macOS](launcher-macos.md), or [Linux](launcher-linux.md)):

1. Open the Topos launcher.
2. Click **Uninstall**.
3. Confirm when prompted.

The launcher removes the installation directory and its own manifest. Docker volumes (your book data) are preserved by default.

If uninstall is interrupted (process killed, Docker locked files, power loss), the launcher writes `cleanup.json` at the start and marks each step as complete. On next launch, the launcher silently retries any step still marked incomplete.

To also remove Docker volumes and images, run the commands in the "What gets removed" section below.

## Path B: Script (all platforms)

If you installed via `install.sh` or want a complete removal including Docker resources:

```bash
cd ~/topos
bash uninstall.sh
```

The script asks for confirmation before removing anything. Type `yes` to proceed.

## What gets removed

The uninstall script removes:

| Component | Location | Command |
|-----------|----------|---------|
| Docker containers | Running stack | `docker compose -f docker-compose.prod.yml down` |
| Docker volumes | Book data, database | `docker volume ls --filter name=topos -q \| xargs docker volume rm` |
| Docker images | Backend + frontend images | `docker images --filter reference='*topos*' -q \| xargs docker image rm` |
| Launcher manifest | Platform config dir | See below |
| Installation directory | `~/topos` (default) | `rm -rf ~/topos` |

Launcher manifest locations:
- Windows: `%APPDATA%\topos\install.json`
- macOS: `~/Library/Application Support/topos/install.json`
- Linux: `~/.config/topos/install.json`

## Keeping your data

If you want to keep your books before uninstalling:

1. Open Topos in the browser
2. Go to the Dashboard
3. Use **Backup** to export each book as a `.bgb` file
4. Save the `.bgb` files somewhere safe
5. Then uninstall

After reinstalling, use **Restore** to import the `.bgb` files back.

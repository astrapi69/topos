"""Bun has one version, and it can read both lockfiles (#25).

Bun is pinned in several places: the workflows (``setup-bun``'s
``bun-version``), ``frontend/Dockerfile`` (the install script's ``bun-v...``),
the dev compose command (``npm install -g bun@...``) and CONTRIBUTING. A
partial upgrade leaves some paths on the old Bun, and the Dockerfile and the
compose command are not on PR CI, so nothing would notice.

The lockfile format follows the Bun that wrote it: Bun 1.3 reads only
``lockfileVersion: 1``, so a lock written by a newer Bun (a developer's global
Bun, Dependabot's own) fails every 1.3 job with "Unknown lockfile version".
The sibling project adaptive-learner hit exactly that (its #3769, #3770).

These tests fail on a pin that differs from the others, and on a lockfile the
pinned Bun cannot read, with a message that names the cause instead of a
frozen-lockfile failure in every job.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# The lockfileVersions each Bun minor line reads, measured 2026-10-16:
# 1.3.14 fails on 3 (adaptive-learner); 1.4.2 installs frozen from 1 (this
# repository's locks), from 2 (what 1.4.2 writes for a fresh lock here) and
# from 3 (adaptive-learner's frontend lock). A pin on a line that is not
# listed fails the test; add the line after checking it
# (``bun install --frozen-lockfile`` on a copy of each format).
LOCKFILE_VERSIONS_READ_BY_BUN = {"1.3": {1}, "1.4": {1, 2, 3}}

PIN_PATTERNS = (
    re.compile(r"bun-version:\s*\"?(\d+\.\d+\.\d+)\"?"),
    re.compile(r"bun@(\d+\.\d+\.\d+)"),
    re.compile(r"bun-v(\d+\.\d+\.\d+)"),
    re.compile(r"^- bun (\d+\.\d+\.\d+)", re.MULTILINE),
)

LOCKFILES = (REPO / "frontend" / "bun.lock", REPO / "e2e" / "bun.lock")


def _pin_files() -> list[Path]:
    files = sorted((REPO / ".github" / "workflows").glob("*.yml"))
    return files + [
        REPO / "frontend" / "Dockerfile",
        REPO / "docker-compose.yml",
        REPO / "CONTRIBUTING.md",
    ]


def _pins() -> dict[str, set[str]]:
    """Every pinned Bun version, mapped to the files that name it."""
    found: dict[str, set[str]] = {}
    for path in _pin_files():
        text = path.read_text(encoding="utf-8")
        for pattern in PIN_PATTERNS:
            for version in pattern.findall(text):
                found.setdefault(version, set()).add(str(path.relative_to(REPO)))
    return found


def _lockfile_version(path: Path) -> int:
    # bun.lock is JSON with trailing commas; the version is on the second line.
    match = re.search(r'"lockfileVersion":\s*(\d+)', path.read_text(encoding="utf-8"))
    assert match, f"no lockfileVersion in {path.relative_to(REPO)}"
    return int(match.group(1))


def test_every_bun_pin_names_the_same_version() -> None:
    pins = _pins()
    assert pins, "no Bun pin found; the patterns no longer match the workflows"
    assert len(pins) == 1, (
        "Bun is pinned to more than one version: "
        f"{json.dumps({v: sorted(f) for v, f in pins.items()})}"
    )


def _must_pin(path: Path) -> bool:
    """Every workflow that sets up Bun, and every other pin file, names a version."""
    if path.parent.name != "workflows":
        return True
    return "setup-bun" in path.read_text(encoding="utf-8")


def test_every_pin_file_names_bun() -> None:
    # A file whose pin the patterns stop matching would drop out silently.
    named = set().union(*_pins().values())
    missing = [
        str(path.relative_to(REPO))
        for path in _pin_files()
        if _must_pin(path) and str(path.relative_to(REPO)) not in named
    ]
    assert not missing, f"no Bun pin recognised in {missing}"


def test_the_pinned_bun_can_read_both_lockfiles() -> None:
    (version,) = _pins()
    line = ".".join(version.split(".")[:2])
    assert line in LOCKFILE_VERSIONS_READ_BY_BUN, (
        f"Bun {version} is pinned, but which lockfileVersions the {line} line reads is not "
        "recorded; check it and add it to LOCKFILE_VERSIONS_READ_BY_BUN"
    )
    readable = LOCKFILE_VERSIONS_READ_BY_BUN[line]
    for lock in LOCKFILES:
        actual = _lockfile_version(lock)
        assert actual in readable, (
            f"{lock.relative_to(REPO)} has lockfileVersion {actual}, which the pinned Bun "
            f"{version} cannot read; regenerate it with Bun {version}, or upgrade every pin "
            "if the lock came from a newer Bun"
        )

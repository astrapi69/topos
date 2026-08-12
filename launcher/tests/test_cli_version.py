"""The launcher must be able to answer "which version are you" without a GUI.

Every per-OS workflow builds an artifact and none of them ever runs it -
"Upload smoke artifact" uploads, it does not execute. That gap held
because ``main()`` had no non-GUI path at all: it went straight from
logging into i18n, the lockfile and the window, so a CI job had nothing
it could invoke and check.

``--version`` closes it: print the embedded version, exit 0, touch
nothing else. The assertions below are what a build job would rely on -
no lockfile written, no GUI reached, and the frozen binary's own version
on stdout.
"""

from __future__ import annotations

import pytest
from topos_launcher import __main__ as launcher_main
from topos_launcher import __version__


def test_version_flag_prints_version_and_exits_zero(capsys, monkeypatch):
    monkeypatch.setattr(launcher_main.sys, "argv", ["topos-launcher", "--version"])

    assert launcher_main.main() == 0
    assert __version__ in capsys.readouterr().out


def test_version_flag_starts_no_gui_and_writes_no_lockfile(monkeypatch):
    """The whole point is that a headless CI job can run this safely."""
    monkeypatch.setattr(launcher_main.sys, "argv", ["topos-launcher", "--version"])

    def fail(*args, **kwargs):  # pragma: no cover - only runs on regression
        raise AssertionError("--version must not reach the launcher body")

    monkeypatch.setattr(launcher_main.lockfile, "write_lock", fail)
    monkeypatch.setattr(launcher_main, "_run_launcher", fail)

    assert launcher_main.main() == 0


def test_short_version_flag_behaves_the_same(capsys, monkeypatch):
    monkeypatch.setattr(launcher_main.sys, "argv", ["topos-launcher", "-V"])

    assert launcher_main.main() == 0
    assert __version__ in capsys.readouterr().out


@pytest.mark.parametrize("argv", [[], ["--show-details"]])
def test_normal_startup_is_untouched(argv, monkeypatch):
    """Without the flag the launcher still runs its usual path."""
    monkeypatch.setattr(launcher_main.sys, "argv", ["topos-launcher", *argv])
    monkeypatch.setattr(launcher_main.lockfile, "another_instance_alive", lambda _p: False)
    monkeypatch.setattr(launcher_main.lockfile, "write_lock", lambda _p: None)
    monkeypatch.setattr(launcher_main.lockfile, "clear_lock", lambda _p: None)
    monkeypatch.setattr(launcher_main, "_run_launcher", lambda: 7)

    assert launcher_main.main() == 7

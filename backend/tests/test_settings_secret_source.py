"""Integration tests for ``GET /api/settings/secret-source``.

Confirms the endpoint returns the right ``source`` label for each
of the resolution-chain branches (env / secrets.yaml / app.yaml
fallback).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    """Redirect ``_get_user_override_path`` to a per-test tmp file and
    clear the env-var so each test can drive the branch it wants."""
    from app import main as main_module

    monkeypatch.setattr(
        main_module, "_get_user_override_path", lambda: tmp_path / "secrets.yaml"
    )
    monkeypatch.delenv("TOPOS_SECRET_KEY", raising=False)
    return TestClient(app)


def test_returns_app_yaml_source_when_no_env_and_no_file(client: TestClient) -> None:
    response = client.get("/api/settings/secret-source")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "app_yaml"
    assert body["path"] is None
    assert body["env_var"] == "TOPOS_SECRET_KEY"


def test_returns_secrets_yaml_source_when_file_has_value(
    client: TestClient, tmp_path: Path
) -> None:
    (tmp_path / "secrets.yaml").write_text(
        'secret_key: "sk-from-file"\n', encoding="utf-8"
    )
    response = client.get("/api/settings/secret-source")
    body = response.json()
    assert body["source"] == "secrets_yaml"
    assert body["path"] == str(tmp_path / "secrets.yaml")


def test_returns_env_source_when_env_var_set(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TOPOS_SECRET_KEY", "sk-from-env")
    response = client.get("/api/settings/secret-source")
    body = response.json()
    assert body["source"] == "env"
    assert body["path"] is None


def test_env_wins_when_both_env_and_file_present(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "secrets.yaml").write_text(
        'secret_key: "from-file"\n', encoding="utf-8"
    )
    monkeypatch.setenv("TOPOS_SECRET_KEY", "from-env")
    response = client.get("/api/settings/secret-source")
    assert response.json()["source"] == "env"

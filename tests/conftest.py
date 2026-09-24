"""Every test runs against a throwaway SQLite file, never tracker.db.

LOOT_LEDGER_DB has to be set before db.py is imported — DB_PATH is read at
import time — so it is set here, at collection, ahead of any app import.
Network and secrets are cut off too: FX rates are pinned, and the secrets
file is pointed at a path that does not exist, so the board is open and the
bot has no key.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="lootledger-test-"))
os.environ["LOOT_LEDGER_DB"] = str(_TMP / "test.db")

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import db  # noqa: E402
import rates  # noqa: E402

RATES = {"USD": 280.0, "GBP": 360.0, "EUR": 300.0, "AED": 76.0}


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    assert Path(db.DB_PATH).parent == _TMP, "tests must never touch the real ledger"
    from api import secrets_reader
    monkeypatch.setattr(secrets_reader, "_SECRETS_PATH", _TMP / "no-secrets.toml")
    monkeypatch.setattr(rates, "get_rates", lambda force=False: {
        "rates": dict(RATES), "source": "test", "fetched_on": "2026-01-01", "stale": False})
    if Path(db.DB_PATH).exists():
        Path(db.DB_PATH).unlink()
    for stale in _TMP.glob("test.db.*"):
        stale.unlink()
    db.init_db()
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from api.main import app
    with TestClient(app) as c:
        yield c

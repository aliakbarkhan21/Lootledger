"""Reads .streamlit/secrets.toml the way Streamlit's st.secrets did, so the
GEMINI_API_KEY / LOOT_LEDGER_PASSWORD / LOOT_LEDGER_DEMO an existing install
already has keep working from the same file after the move off Streamlit.
Precedence is the old access.setting()'s: secrets file first, then the
environment.
"""
from __future__ import annotations

import os
import tomllib
from pathlib import Path

_SECRETS_PATH = Path(__file__).resolve().parent.parent / ".streamlit" / "secrets.toml"


def _load() -> dict:
    if not _SECRETS_PATH.exists():
        return {}
    try:
        return tomllib.loads(_SECRETS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def setting(name: str, default=None):
    found = _load().get(name)
    if found not in (None, ""):
        return found
    found = os.environ.get(name)
    return found if found not in (None, "") else default


def auth_block():
    return _load().get("auth")

"""Who may open the board, and which instance shows real records.

This is the FastAPI-native port of access.py's *policy* — access.py's own
`is_demo()` / `mode()` / `seed_demo_if_empty()` logic, kept behaviorally
identical, just read through secrets_reader instead of st.secrets. Its
*rendering* half (the st.form password screen, st.login()/st.user OIDC) was
Streamlit page code, not logic, and is replaced by routers/auth.py plus a
React sign-in screen. access.py went with the Streamlit app; its history is in
git.
"""
from __future__ import annotations

import db
import demo
from api.secrets_reader import setting, auth_block


def _truthy(value) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def is_demo() -> bool:
    """Whether this instance is a sample board rather than the real ledger."""
    return _truthy(setting("LOOT_LEDGER_DEMO", "0"))


def oidc_configured() -> bool:
    return bool(auth_block())


def mode() -> str:
    """Which gate applies: 'open', 'oidc' or 'password'."""
    if is_demo() and demo.is_active():
        return "open"
    if oidc_configured():
        return "oidc"
    if setting("LOOT_LEDGER_PASSWORD"):
        return "password"
    return "open"


def seed_demo_if_empty() -> None:
    """Give a sample instance something to show. No-op unless this instance
    is explicitly marked as a demo AND the ledger is completely empty."""
    if not is_demo():
        return
    counts = db.row_counts()
    if sum(counts.values()) > 0:
        return
    demo.seed(3)

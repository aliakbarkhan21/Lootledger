"""The access gate: open / password, and what to do about an [auth] block.

Full OIDC sign-in (Streamlit's st.login()/st.user, backed by an [auth] block
in secrets.toml) is not reimplemented — it was a framework-managed feature
with no FastAPI equivalent to port. An [auth] block still means its owner
wanted a gate, so it never falls open: with LOOT_LEDGER_PASSWORD also set the
password gate applies, and without one the board stays locked and the page
says which setting to add. The owner fixes that in their own secrets file,
so nobody is locked out for good.
"""
from __future__ import annotations

import hmac
import secrets as pysecrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from api.secrets_reader import setting
from api import access_policy

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "ll_session"
_SESSIONS: set[str] = set()


def effective_mode() -> str:
    raw = access_policy.mode()
    if raw == "oidc":
        return "password" if setting("LOOT_LEDGER_PASSWORD") else "blocked"
    return raw


def require_access(request: Request) -> None:
    """FastAPI dependency: raise 401 unless this request is allowed through."""
    if effective_mode() == "open":
        return
    token = request.cookies.get(COOKIE_NAME)
    if token and token in _SESSIONS:
        return
    raise HTTPException(status_code=401, detail="This board is locked.")


@router.get("/status")
def status(request: Request):
    mode = effective_mode()
    unlocked = mode == "open" or request.cookies.get(COOKIE_NAME) in _SESSIONS
    return {
        "mode": mode,
        "raw_mode": access_policy.mode(),
        "unlocked": unlocked,
        "demo": access_policy.is_demo(),
    }


@router.post("/login")
def login(payload: dict, response: Response):
    if effective_mode() != "password":
        raise HTTPException(400, "No password gate is configured.")
    given = str((payload or {}).get("password", ""))
    expected = str(setting("LOOT_LEDGER_PASSWORD") or "")
    # compare_digest, not ==, so the comparison does not leak timing info.
    if not expected or not hmac.compare_digest(given, expected):
        raise HTTPException(401, "That is not the password.")
    token = pysecrets.token_urlsafe(32)
    _SESSIONS.add(token)
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )
    return {"ok": True}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        _SESSIONS.discard(token)
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}

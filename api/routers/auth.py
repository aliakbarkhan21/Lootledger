"""The access gate: open / password / (best-effort) oidc.

Full OIDC sign-in (Streamlit's st.login()/st.user, backed by an [auth] block
in secrets.toml) is not reimplemented here — that is a framework-managed
feature with no FastAPI equivalent to port, and building a new OAuth flow is
out of scope for this rewrite. If [auth] is configured, this falls back to
the password gate when LOOT_LEDGER_PASSWORD is also set, and to open
otherwise — so an owner is never locked out of their own local app by a gate
this API can't perform, but a real OIDC sign-in screen is a known gap.
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
        return "password" if setting("LOOT_LEDGER_PASSWORD") else "open"
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

"""Request-scoped wiring between the API layer and the untouched Python core.

No money logic lives here — every function just points db.py/finance.py/
rates.py at the request the way app.py used to point them at a Streamlit
rerun. The frame cache mirrors app.py's own `_db_fingerprint()` trick: reload
`tracker.db` only when the file on disk has actually changed, so two browser
tabs (or the bot and the board) never disagree about what's in the ledger.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import db          # noqa: E402
import finance      # noqa: E402
import rates        # noqa: E402

_frames_cache: dict = {"fingerprint": None, "frames": None}


def _db_fingerprint():
    try:
        stat = db.DB_PATH.stat()
        return (stat.st_mtime_ns, stat.st_size)
    except FileNotFoundError:
        return None


def get_frames() -> "finance.Frames":
    fp = _db_fingerprint()
    if _frames_cache["frames"] is None or _frames_cache["fingerprint"] != fp:
        _frames_cache["frames"] = finance.load_frames()
        _frames_cache["fingerprint"] = fp
    return _frames_cache["frames"]


def currency_context() -> dict:
    """Point finance.py's module-level opening balance / netting / currency
    globals at whatever is currently in the database, exactly as app.py did
    once per rerun, and hand back the rates payload so callers don't have to
    fetch it twice."""
    opening = db.get_meta("opening_balance")
    finance.set_opening_balance(float(opening) if opening else 0.0)

    net_flag = db.get_meta("net_same_month_debts")
    finance.set_net_same_month_debts(net_flag != "0")

    code = rates.get_currency()
    rates_payload = rates.get_rates()
    rate = rates.rate_for(code, rates_payload["rates"])
    symbol = rates.CURRENCIES[code][0]
    finance.set_display_currency(code, symbol, rate)
    return {**rates_payload, "code": code, "symbol": symbol, "rate": rate}


def board_context():
    """FastAPI dependency: (frames, currency) for any route that reads the board."""
    currency = currency_context()
    frames = get_frames()
    return frames, currency


def to_pkr(amount: float) -> float:
    """A figure typed while the board is being read in another currency,
    converted back to the rupees everything is stored as — the same
    arithmetic app.py's own to_pkr() used. Callers must run currency_context()
    first so finance.display_currency() reflects the request's currency."""
    _, _, rate = finance.display_currency()
    return float(amount) * rate


def df_records(df) -> list[dict]:
    """A pandas DataFrame of board rows as JSON-safe dicts (numpy scalars
    stringified/floated so FastAPI's encoder doesn't choke on them)."""
    if df is None or df.empty:
        return []
    out = []
    for row in df.to_dict("records"):
        clean = {}
        for k, v in row.items():
            if k.startswith("_"):
                continue
            if hasattr(v, "item"):
                v = v.item()
            clean[k] = v
        out.append(clean)
    return out

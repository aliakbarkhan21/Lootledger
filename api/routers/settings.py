"""Settings dialog: opening balance, same-month debt netting, currency and
FX rates, budgets summary, backups/restore, demo data, CSV export, and the
two-step destructive actions (erase everything). Budgets themselves live in
budgets.py; recurring templates in recurring.py.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response

import db
import demo
import importer
import rates

from api.deps import currency_context, get_frames, to_pkr
from api.routers.auth import require_access
from api.schemas import BoolFlagIn, CurrencyIn, OpeningBalanceIn, RestoreIn

router = APIRouter(prefix="/api/settings", tags=["settings"],
                    dependencies=[Depends(require_access)])


@router.get("")
def read_settings(currency=Depends(currency_context)):
    return {
        "counts": db.row_counts(),
        "opening_balance": float(db.get_meta("opening_balance") or 0.0),
        "opening_balance_set": db.get_meta("opening_balance") is not None,
        "net_same_month_debts": db.get_meta("net_same_month_debts") != "0",
        "currency": currency,
        "currencies": {code: {"symbol": sym, "label": label}
                       for code, (sym, label, _) in rates.CURRENCIES.items()},
        "budgets": db.get_budgets(),
        "recurring": db.get_recurring(),
        "demo_active": demo.is_active(),
    }


@router.post("/opening-balance")
def set_opening_balance(body: OpeningBalanceIn, currency=Depends(currency_context)):
    db.set_meta("opening_balance", str(to_pkr(body.value)))
    return {"ok": True}


@router.post("/net-same-month-debts")
def set_net_same_month_debts(body: BoolFlagIn):
    db.set_meta("net_same_month_debts", "1" if body.value else "0")
    return {"ok": True}


@router.get("/currency/rates")
def get_rates():
    return currency_context()


@router.post("/currency/rates/refresh")
def refresh_rates():
    payload = rates.get_rates(force=True)
    code = rates.get_currency()
    rate = rates.rate_for(code, payload["rates"])
    symbol = rates.CURRENCIES[code][0]
    return {**payload, "code": code, "symbol": symbol, "rate": rate}


@router.post("/currency")
def set_currency(body: CurrencyIn):
    try:
        rates.set_currency(body.code)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"ok": True}


@router.get("/backups")
def list_backups():
    return [
        {"name": b["name"], "path": str(b["path"]), "taken": b["taken"],
         "size": b["size"], "counts": b["counts"], "total": b["total"],
         "automatic": b["automatic"]}
        for b in db.list_backups()
    ]


@router.post("/backups/restore")
def restore_backup(body: RestoreIn):
    known = {str(b["path"]) for b in db.list_backups()}
    if body.path not in known:
        raise HTTPException(400, "Unknown backup path.")
    db.restore_backup(body.path)
    return {"ok": True}


# Both demo actions are refused server-side, not just greyed out in the UI:
# sample rows are never mixed into real records, and demo.clear() wipes every
# ledger, so it may only run while the sample is all that is there.
@router.post("/demo/seed")
def seed_demo():
    if not demo.is_active() and sum(db.row_counts().values()) > 0:
        raise HTTPException(409, "Clear your real records first — sample rows are "
                                 "never mixed into data you entered.")
    counts = demo.seed(3)
    return {"counts": counts}


@router.post("/demo/clear")
def clear_demo():
    if not demo.is_active():
        raise HTTPException(409, "No sample data is loaded.")
    demo.clear()
    return {"ok": True}


@router.post("/reset/erase")
def erase_everything():
    db.erase_all()
    return {"ok": True}


@router.get("/export/csv")
def export_csv():
    csv_text = importer.export_csv()
    return Response(
        content=csv_text, media_type="text/csv",
        headers={"Content-Disposition":
                 f"attachment; filename=loot-ledger-{date.today().isoformat()}.csv"},
    )

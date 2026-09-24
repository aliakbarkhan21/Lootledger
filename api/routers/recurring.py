from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

import db

from api.deps import currency_context, to_pkr
from api.routers.auth import require_access
from api.schemas import RecurringIn

router = APIRouter(prefix="/api/recurring", tags=["recurring"],
                    dependencies=[Depends(require_access)])


def _today_key() -> str:
    return date.today().strftime("%Y-%m")


@router.get("")
def list_recurring():
    return db.get_recurring()


@router.post("")
def add_recurring(body: RecurringIn, currency=Depends(currency_context)):
    row_id = db.add_recurring(body.label.strip(), body.kind, body.category,
                              to_pkr(body.amount), body.day_of_month)
    return {"id": row_id}


@router.delete("/{row_id}")
def delete_recurring(row_id: int):
    db.delete_recurring(row_id)
    return {"ok": True}


def _due() -> list[dict]:
    today_day = date.today().day
    current = _today_key()
    return [r for r in db.get_recurring()
            if r["last_logged"] != current and today_day >= r["day_of_month"]]


@router.post("/log-all")
def log_all():
    today = str(date.today())
    period = _today_key()
    logged = []
    for r in _due():
        if r["kind"] == "income":
            db.add_income(today, r["label"], r["amount"])
        else:
            db.add_expense(today, r["label"], r["category"] or "Other", r["amount"])
        db.mark_recurring_logged(r["id"], period)
        logged.append(r["id"])
    return {"logged": logged}


@router.post("/skip-all")
def skip_all():
    period = _today_key()
    skipped = []
    for r in _due():
        db.mark_recurring_logged(r["id"], period)
        skipped.append(r["id"])
    return {"skipped": skipped}

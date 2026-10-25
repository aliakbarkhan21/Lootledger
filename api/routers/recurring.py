from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

import db

from api.deps import currency_context, to_pkr
from api.routers.auth import require_access
from api.schemas import RecurringIn, RecurringResolveIn

router = APIRouter(prefix="/api/recurring", tags=["recurring"],
                    dependencies=[Depends(require_access)])


def _today_key() -> str:
    return date.today().strftime("%Y-%m")


def _entry_key(label: str, amount: float) -> tuple[str, float]:
    return (str(label).strip().lower(), round(float(amount), 2))


def recurring_with_status() -> list[dict]:
    """Every template, plus where it stands this month: "logged" when a ledger
    entry of the same kind, label (case-insensitive) and amount is dated this
    month, else "not_logged" once its day has arrived, else "upcoming". This
    reads the ledgers themselves, not last_logged, which "Not this month" and
    "Log all" set and hand-typed entries never do."""
    period = _today_key()
    seen = {"expense": {_entry_key(*e) for e in db.month_entries("expenses", period)},
            "income": {_entry_key(*e) for e in db.month_entries("income", period)}}
    today_day = date.today().day
    out = []
    for r in db.get_recurring():
        if _entry_key(r["label"], r["amount"]) in seen[r["kind"]]:
            status = "logged"
        elif today_day >= r["day_of_month"]:
            status = "not_logged"
        else:
            status = "upcoming"
        out.append({**r, "status": status})
    return out


@router.get("")
def list_recurring():
    return recurring_with_status()


@router.post("")
def add_recurring(body: RecurringIn, currency=Depends(currency_context)):
    row_id = db.add_recurring(body.label.strip(), body.kind, body.category,
                              to_pkr(body.amount), body.day_of_month)
    return {"id": row_id}


@router.put("/{row_id}")
def update_recurring(row_id: int, body: RecurringIn, currency=Depends(currency_context)):
    db.update_recurring(row_id, body.label.strip(), body.kind, body.category,
                        to_pkr(body.amount), body.day_of_month)
    return {"ok": True}


@router.delete("/{row_id}")
def delete_recurring(row_id: int):
    db.delete_recurring(row_id)
    return {"ok": True}


def _due() -> list[dict]:
    today_day = date.today().day
    current = _today_key()
    return [r for r in db.get_recurring()
            if r["last_logged"] != current and today_day >= r["day_of_month"]]


def _log_entry(r: dict, today: str) -> None:
    if r["kind"] == "income":
        db.add_income(today, r["label"], r["amount"])
    else:
        db.add_expense(today, r["label"], r["category"] or "Other", r["amount"])


@router.post("/log-all")
def log_all():
    today = str(date.today())
    period = _today_key()
    logged = []
    for r in _due():
        _log_entry(r, today)
        db.mark_recurring_logged(r["id"], period)
        logged.append(r["id"])
    return {"logged": logged}


@router.post("/{row_id}/log")
def log_one(row_id: int):
    """Log one template now, whether or not its day has arrived. Refuses when
    this month already holds a matching entry, so a double click or a second
    tab can never write it twice."""
    row = next((r for r in recurring_with_status() if r["id"] == row_id), None)
    if row is None:
        raise HTTPException(404, "No such recurring item.")
    if row["status"] == "logged":
        raise HTTPException(409, f"{row['label']} is already logged this month.")
    _log_entry(row, str(date.today()))
    db.mark_recurring_logged(row_id, _today_key())
    return {"logged": row_id}


@router.post("/resolve")
def resolve(body: RecurringResolveIn):
    """Log some of the due items and skip others for this month. Ids that are
    not due (or do not exist) are ignored; an id in both lists is logged."""
    today = str(date.today())
    period = _today_key()
    log_ids = set(body.log_ids)
    skip_ids = set(body.skip_ids) - log_ids
    logged, skipped = [], []
    for r in _due():
        if r["id"] in log_ids:
            _log_entry(r, today)
            db.mark_recurring_logged(r["id"], period)
            logged.append(r["id"])
        elif r["id"] in skip_ids:
            db.mark_recurring_logged(r["id"], period)
            skipped.append(r["id"])
    return {"logged": logged, "skipped": skipped}


@router.post("/skip-all")
def skip_all():
    period = _today_key()
    skipped = []
    for r in _due():
        db.mark_recurring_logged(r["id"], period)
        skipped.append(r["id"])
    return {"skipped": skipped}

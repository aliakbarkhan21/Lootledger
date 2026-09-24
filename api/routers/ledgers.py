"""Writes to the five ledgers: the sidebar entry form, the Edit tab grids, and
the board's per-row remove/un-settle action. Every write here is a direct,
unmodified call into db.py — amounts arrive in the board's current display
currency (matching the old sidebar form) and are converted to PKR with
deps.to_pkr() before they reach db.py, which only ever sees rupees.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

import db
import finance

from api.deps import currency_context, to_pkr
from api.routers.auth import require_access
from api.schemas import (BorrowedIn, ExpenseIn, IncomeIn, LentIn, RowUpdate,
                          SettleIn, TransportIn)

router = APIRouter(prefix="/api", tags=["ledgers"], dependencies=[Depends(require_access)])

LEDGERS = db.LEDGERS


@router.get("/ledgers/{ledger}")
def list_ledger(ledger: str):
    if ledger not in LEDGERS:
        raise HTTPException(404, f"No such ledger: {ledger!r}")
    getter = {
        "expenses": db.get_expenses, "transport": db.get_transport,
        "income": db.get_income, "lent": db.get_lent, "borrowed": db.get_borrowed,
    }[ledger]
    return getter()


@router.post("/expenses")
def add_expense(body: ExpenseIn, currency=Depends(currency_context)):
    row_id = db.add_expense(body.date, body.description.strip(), body.category,
                            to_pkr(body.amount))
    return {"id": row_id}


@router.post("/transport")
def add_transport(body: TransportIn, currency=Depends(currency_context)):
    row_id = db.add_transport(body.date, to_pkr(body.amount))
    return {"id": row_id}


@router.post("/income")
def add_income(body: IncomeIn, currency=Depends(currency_context)):
    row_id = db.add_income(body.date, body.source.strip(), to_pkr(body.amount))
    return {"id": row_id}


@router.post("/lent")
def add_lent(body: LentIn, currency=Depends(currency_context)):
    row_id = db.add_lent(body.date, body.person.strip(), to_pkr(body.amount), body.kind)
    return {"id": row_id}


@router.post("/borrowed")
def add_borrowed(body: BorrowedIn, currency=Depends(currency_context)):
    row_id = db.add_borrowed(body.date, body.lender.strip(), to_pkr(body.amount), body.kind)
    return {"id": row_id}


@router.patch("/ledgers/{ledger}/{row_id}")
def update_row(ledger: str, row_id: int, body: RowUpdate, currency=Depends(currency_context)):
    if ledger not in LEDGERS:
        raise HTTPException(404, f"No such ledger: {ledger!r}")
    allowed = db.EDITABLE[ledger]
    fields = body.model_dump(exclude_unset=True)
    updates = {}
    for key, value in fields.items():
        if key not in allowed or value is None:
            continue
        if key == "amount":
            value = to_pkr(value)
        elif key == "paid_back":
            value = 1 if value else 0
        updates[key] = value
    if not updates:
        return {"changed": 0}
    changed = db.update_row(ledger, row_id, **updates)
    return {"changed": changed}


@router.delete("/ledgers/{ledger}/{row_id}")
def delete_row(ledger: str, row_id: int):
    if ledger not in LEDGERS:
        raise HTTPException(404, f"No such ledger: {ledger!r}")
    db.delete_row(ledger, row_id)
    return {"ok": True}


@router.post("/debts/{table}/{row_id}/settle")
def settle(table: str, row_id: int, body: SettleIn):
    if table not in ("lent", "borrowed"):
        raise HTTPException(404, f"No such debt table: {table!r}")
    settled_date = body.date or str(date.today())
    db.set_paid_back(table, row_id, body.settled, settled_date if body.settled else None)
    return {"ok": True}


# Board rows are display rows, not raw ledger rows: a settlement (money
# returning/being repaid) shows up as its own arrival/departure line with a
# `kind` that isn't a ledger name. Clicking one of those un-settles the debt
# it came from rather than deleting a row that doesn't exist on its own.
_RECORD_KINDS = {
    "expense": "expenses", "transport": "transport", "income": "income",
    "lent": "lent", "borrowed": "borrowed",
}
_SETTLEMENT_KINDS = {"lent_returned": "lent", "borrowed_repaid": "borrowed"}


@router.post("/board-rows/remove")
def remove_board_row(body: dict):
    kind = body.get("kind")
    row_id = body.get("id")
    if kind in _RECORD_KINDS:
        db.delete_row(_RECORD_KINDS[kind], row_id)
        return {"ok": True, "action": "deleted"}
    if kind in _SETTLEMENT_KINDS:
        db.set_paid_back(_SETTLEMENT_KINDS[kind], row_id, False, None)
        return {"ok": True, "action": "unsettled"}
    raise HTTPException(400, f"Unknown row kind: {kind!r}")


@router.get("/debts/people")
def people():
    from api.deps import get_frames
    frames = get_frames()
    return finance.people_ledger(frames)

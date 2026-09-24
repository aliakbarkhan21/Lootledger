from __future__ import annotations

from fastapi import APIRouter, Depends

import db

from api.deps import currency_context, to_pkr
from api.routers.auth import require_access
from api.schemas import BudgetIn, MergeCategoryIn

router = APIRouter(prefix="/api", tags=["budgets"], dependencies=[Depends(require_access)])


@router.get("/budgets")
def list_budgets():
    return db.get_budgets()


@router.post("/budgets")
def set_budget(body: BudgetIn, currency=Depends(currency_context)):
    db.set_budget(body.category, to_pkr(body.monthly_cap))
    return {"ok": True}


@router.delete("/budgets/{category}")
def delete_budget(category: str):
    db.delete_budget(category)
    return {"ok": True}


@router.post("/categories/merge")
def merge_category(body: MergeCategoryIn):
    moved = db.rename_category(body.from_category, body.to_category)
    budgets = db.get_budgets()
    if body.from_category in budgets:
        db.delete_budget(body.from_category)
    return {"moved": moved}


@router.get("/categories")
def list_categories():
    return db.CATEGORIES

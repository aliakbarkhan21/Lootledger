"""The main board: everything the Ledger Journal page needs for one period,
in a single response — the same "donut and trend read the shared helper, so
they can never disagree" principle finance.py itself is built on, just
extended to the whole page rather than one panel.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

import db
import demo
import finance

from api.deps import board_context, df_records
from api.routers.auth import require_access

router = APIRouter(prefix="/api", tags=["board"], dependencies=[Depends(require_access)])

RUN_STRIP_MONTHS = 12
CATEGORY_BASELINE_MONTHS = 6
INCOME_TREND_MONTHS = 12


def _today_key() -> str:
    return date.today().strftime("%Y-%m")


def _resolve_period(raw: str | None) -> str:
    if not raw or raw.lower() in ("all", "all_time", "alltime", finance.ALL_TIME.lower()):
        return finance.ALL_TIME
    return raw


@router.get("/periods")
def periods(ctx=Depends(board_context)):
    frames, currency = ctx
    series = finance.month_series(frames)
    keys = sorted(series)
    return {
        "current": _today_key(),
        "months": [
            {"key": k, "label": finance.month_label(k), "short": finance.month_short(k),
             "outflow": series[k].outflow}
            for k in keys
        ],
    }


def _category_trend(frames, key: str, series: dict, by_category_records: list[dict]) -> dict:
    if key == finance.ALL_TIME:
        months = sorted(series)[-RUN_STRIP_MONTHS:]
        return {
            "mode": "monthly",
            "months": months,
            "series": finance.category_series(frames, months),
            "vs_avg": {},
        }

    daily = finance.category_daily(frames, key)
    # Baseline: up to 6 completed months strictly before this one, so "is my
    # Food spending rising" compares against a real recent habit rather than
    # the whole history (which would blur a January-vs-July seasonal category).
    earlier = sorted(k for k in series if k < key)[-CATEGORY_BASELINE_MONTHS:]
    baseline = finance.category_series(frames, earlier) if earlier else {}
    current_by_cat = {r["category"]: float(r["amount"]) for r in by_category_records}
    vs_avg: dict[str, float | None] = {}
    for cat, values in baseline.items():
        avg = (sum(values) / len(values)) if values else 0.0
        cur = current_by_cat.get(cat, 0.0)
        vs_avg[cat] = ((cur - avg) / avg * 100.0) if avg > 0 else None
    return {"mode": "daily", "months": [key], "series": daily, "vs_avg": vs_avg}


def _income_trend(frames, key: str, series: dict) -> dict:
    all_keys = sorted(series)
    anchor = all_keys[-1] if key == finance.ALL_TIME else key
    window = [k for k in all_keys if k <= anchor][-INCOME_TREND_MONTHS:]
    source_data = finance.source_series(frames, window)
    current = {r["source"]: float(r["amount"])
               for r in finance.income_by_source(frames, key).to_dict("records")}
    earlier = window[:-1] if key != finance.ALL_TIME else window
    vs_avg: dict[str, float | None] = {}
    for source, values in source_data.items():
        base_values = values[:-1] if key != finance.ALL_TIME else values
        avg = (sum(base_values) / len(base_values)) if base_values else 0.0
        cur = current.get(source, 0.0)
        vs_avg[source] = ((cur - avg) / avg * 100.0) if avg > 0 else None
    return {"months": window, "series": source_data, "vs_avg": vs_avg}


def _due_recurring() -> list[dict]:
    """Recurring templates whose day has arrived and aren't logged (or
    skipped) yet this calendar month — the exact rule app.py's own
    due_recurring() used."""
    today_day = date.today().day
    current = _today_key()
    return [r for r in db.get_recurring()
            if r["last_logged"] != current and today_day >= r["day_of_month"]]


@router.get("/board")
def board(period: str | None = Query(default=None), ctx=Depends(board_context)):
    frames, currency = ctx
    key = _resolve_period(period)
    series = finance.month_series(frames, through=None if key == finance.ALL_TIME else key)
    snap = finance.snapshot(frames, key)

    by_category = df_records(snap.by_category)
    income_by_source = df_records(finance.income_by_source(frames, key))

    calendar = None
    if key != finance.ALL_TIME:
        days = finance.days_in_period(key)
        calendar = {
            "days_in_month": days,
            "daily_outflow": finance.daily_outflow(frames, key),
            "category_by_day": {str(d): [[c, a] for c, a in cats]
                                 for d, cats in finance.category_by_day(frames, key).items()},
            "today_day": date.today().day if key == _today_key() else None,
        }

    usual_daily = None
    if key != finance.ALL_TIME:
        usual_daily = finance.usual_daily_outflow(series, key)

    run_keys = sorted(series)[-RUN_STRIP_MONTHS:]
    run_strip = [
        {"key": k, "short": finance.month_short(k), "outflow": series[k].outflow,
         "closing": series[k].closing, "is_current": k == key}
        for k in run_keys
    ]

    top = snap.top_category
    counts = db.row_counts()

    return {
        "period": {
            "key": snap.key, "label": snap.label,
            "is_all_time": key == finance.ALL_TIME,
            "prev_key": snap.prev_key,
        },
        "currency": currency,
        "figures": {
            "opening": snap.opening, "inflow": snap.inflow, "outflow": snap.outflow,
            "on_hand": snap.on_hand, "savings_rate": snap.savings_rate,
            "burn_pct": snap.burn_pct, "status": snap.status,
            "outflow_delta_pct": snap.outflow_delta_pct,
            "receivable_open": snap.receivable_open, "payable_open": snap.payable_open,
            "receivable_count": snap.receivable_count, "payable_count": snap.payable_count,
            "net_worth": snap.net_worth, "has_activity": snap.has_activity,
            "top_category": {"category": top[0], "amount": top[1]} if top else None,
        },
        "arrivals": df_records(snap.arrivals),
        "departures": df_records(snap.departures),
        "by_category": by_category,
        "income_by_source": income_by_source,
        "capacity": {
            "burn_pct": snap.burn_pct,
            "usual_daily_outflow": usual_daily,
            "days_in_period": finance.days_in_period(key) if key != finance.ALL_TIME else None,
        },
        "trend": {
            "category": _category_trend(frames, key, series, by_category),
            "income": _income_trend(frames, key, series),
        },
        "calendar": calendar,
        "run_strip": run_strip,
        "budgets": db.get_budgets(),
        "banners": {
            "demo_active": demo.is_active(),
            "setup_hint_hidden": db.get_meta("setup_hint_hidden") == "1",
            "opening_balance_set": db.get_meta("opening_balance") is not None,
            "budgets_set": bool(db.get_budgets()),
            "digest": _digest(series),
            "recurring_due": _due_recurring(),
        },
        "counts": counts,
    }


def _digest(series) -> dict:
    """app.py's monthly-digest rules: only when last month had any activity
    and it has not been dismissed this month. Generation is one Gemini call on
    the first load of a new month, deferred so it never holds the board up —
    here the page fires /api/bot/digest/generate when `needs_generation`."""
    current = _today_key()
    last = finance.shift_month(current, -1)
    row = series.get(last)
    eligible = (db.get_meta("digest_dismissed_for") != current
                and bool(row and (row.inflow or row.outflow)))
    needs_generation = eligible and db.get_meta("digest_period") != current
    text = db.get_meta("digest_text") if eligible and not needs_generation else None
    return {"label": finance.month_label(last), "text": text or None,
            "needs_generation": needs_generation}


@router.post("/banners/setup-hint/dismiss")
def dismiss_setup_hint():
    db.set_meta("setup_hint_hidden", "1")
    return {"ok": True}


@router.post("/banners/digest/dismiss")
def dismiss_digest():
    db.set_meta("digest_dismissed_for", _today_key())
    return {"ok": True}

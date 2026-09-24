"""The JSON API over the unchanged Python core: every write path the page
uses, the figures it reads back, and the guards that protect real records."""
from __future__ import annotations

import json
from datetime import date, timedelta

import db

TODAY = date.today()
PERIOD = TODAY.strftime("%Y-%m")
DAY = TODAY.isoformat()
LAST_MONTH = (TODAY.replace(day=1) - timedelta(days=1)).replace(day=1).isoformat()


def _board(client, period=PERIOD):
    res = client.get(f"/api/board?period={period}")
    assert res.status_code == 200
    return res.json()


def test_health_and_open_access(client):
    assert client.get("/api/health").json() == {"ok": True}
    status = client.get("/api/auth/status").json()
    assert status["mode"] == "open" and status["unlocked"] is True


def test_entries_land_on_the_board_and_the_equation_holds(client):
    client.post("/api/settings/opening-balance", json={"value": 1000})
    client.post("/api/income", json={"date": DAY, "source": "Salary", "amount": 5000})
    client.post("/api/expenses", json={"date": DAY, "description": "Tea", "category": "Food", "amount": 200})
    client.post("/api/lent", json={"date": DAY, "person": "Sara", "amount": 300, "kind": "cash"})
    client.post("/api/lent", json={"date": DAY, "person": "Boss", "amount": 900, "kind": "owed"})
    client.post("/api/borrowed", json={"date": DAY, "lender": "Bhai", "amount": 400, "kind": "covered"})

    f = _board(client)["figures"]
    assert f["inflow"] == 5000 and f["outflow"] == 200
    # Cash lent leaves now; owed and covered move no cash on the opening leg.
    assert f["departures_total"] == 500
    assert f["arrivals_total"] == 5000
    assert round(f["opening"] + f["arrivals_total"] - f["departures_total"], 2) == f["on_hand"]
    assert f["receivable_open"] == 1200 and f["payable_open"] == 400


def test_amounts_typed_in_a_display_currency_are_stored_in_rupees(client):
    client.post("/api/settings/currency", json={"code": "USD"})
    client.post("/api/expenses", json={"date": DAY, "description": "Book", "category": "Other", "amount": 10})
    row = db.get_expenses()[0]
    assert row["amount"] == 2800.0          # 10 USD at the pinned 280
    rid = row["id"]
    client.patch(f"/api/ledgers/expenses/{rid}", json={"amount": 20})
    assert db.get_expenses()[0]["amount"] == 5600.0
    client.post("/api/settings/currency", json={"code": "PKR"})


def test_edit_delete_and_unknown_ledger(client):
    client.post("/api/income", json={"date": DAY, "source": "Gift", "amount": 100})
    rid = db.get_income()[0]["id"]
    assert client.patch(f"/api/ledgers/income/{rid}", json={"source": "Birthday"}).json()["changed"] == 1
    assert db.get_income()[0]["source"] == "Birthday"
    assert client.delete(f"/api/ledgers/income/{rid}").status_code == 200
    assert db.get_income() == []
    assert client.get("/api/ledgers/nope").status_code == 404


def test_settle_unsettle_and_removal_effect(client):
    # Lent last month so this month's repayment is not a same-month round trip
    # (those are netted off the board by default).
    client.post("/api/lent", json={"date": LAST_MONTH, "person": "Sara", "amount": 300, "kind": "cash"})
    rid = db.get_lent()[0]["id"]
    # Unsettled cash loan: deleting it puts the 300 back.
    assert client.get(f"/api/debts/lent/{rid}/remove-effect").json()["effect"] == 300
    client.post(f"/api/debts/lent/{rid}/settle", json={"settled": True})
    assert db.get_lent()[0]["paid_back"] == 1
    assert abs(client.get(f"/api/debts/lent/{rid}/remove-effect").json()["effect"]) < 0.005
    arrivals = _board(client)["arrivals"]
    assert any(r["kind"] == "lent_returned" for r in arrivals)
    # Removing the repayment row un-settles the debt rather than deleting it.
    client.post("/api/board-rows/remove", json={"kind": "lent_returned", "id": rid})
    assert db.get_lent()[0]["paid_back"] == 0


def test_people_ledger_nets_both_directions(client):
    client.post("/api/lent", json={"date": DAY, "person": "Ali", "amount": 500, "kind": "cash"})
    client.post("/api/borrowed", json={"date": DAY, "lender": "Ali", "amount": 200, "kind": "cash"})
    people = client.get("/api/debts/people").json()
    ali = next(p for p in people if p["name"] == "Ali")
    assert ali["net"] == 300 and ali["both_ways"] is True


def test_budgets_recurring_and_merge(client):
    client.post("/api/budgets", json={"category": "Food", "monthly_cap": 4000})
    assert client.get("/api/budgets").json() == {"Food": 4000.0}
    client.post("/api/recurring", json={"label": "Rent", "kind": "expense", "category": "Other",
                                        "amount": 100, "day_of_month": 1})
    due = _board(client)["banners"]["recurring_due"]
    assert [r["label"] for r in due] == ["Rent"]
    client.post("/api/recurring/log-all")
    assert [e["description"] for e in db.get_expenses()] == ["Rent"]
    assert _board(client)["banners"]["recurring_due"] == []
    moved = client.post("/api/categories/merge", json={"from_category": "Other", "to_category": "Food"}).json()
    assert moved["moved"] == 1 and db.get_expenses()[0]["category"] == "Food"


def test_import_auto_detects_and_commits(client):
    csv = b"Date,Item,Category,Amount\n2026-09-01,Tea,Food,120\n2026-09-02,Bus,Transportation,80\n"
    up = client.post("/api/import/upload", files={"file": ("sheet.csv", csv, "text/csv")}).json()
    uid = up["upload_id"]
    parsed = client.post(f"/api/import/parse?upload_id={uid}").json()
    assert parsed["row_count"] == 2
    sections = client.post(f"/api/import/detect?upload_id={uid}").json()
    assert list(sections) == ["expenses"] and sections["expenses"]["total"] == 200
    done = client.post(f"/api/import/commit/{uid}/expenses?replace=false").json()
    assert done["imported"] == 2 and len(db.get_expenses()) == 2


def test_demo_data_is_never_mixed_with_real_records(client):
    client.post("/api/income", json={"date": DAY, "source": "Salary", "amount": 1})
    assert client.post("/api/settings/demo/seed").status_code == 409
    # Clearing sample data wipes every ledger, so it is refused when none is loaded.
    assert client.post("/api/settings/demo/clear").status_code == 409
    assert len(db.get_income()) == 1


def test_erase_takes_a_snapshot_that_restores(client):
    client.post("/api/income", json={"date": DAY, "source": "Salary", "amount": 1})
    client.post("/api/settings/reset/erase")
    assert sum(db.row_counts().values()) == 0
    backups = client.get("/api/settings/backups").json()
    assert backups and backups[0]["total"] == 1
    client.post("/api/settings/backups/restore", json={"path": backups[0]["path"]})
    assert len(db.get_income()) == 1
    assert client.post("/api/settings/backups/restore", json={"path": "C:/elsewhere.db"}).status_code == 400


def test_chats_read_the_streamlit_format_unchanged(client):
    # Exactly what the Streamlit app stored: a list of {id, name, messages}.
    db.set_meta("chat_sessions", json.dumps([
        {"id": "1", "name": "Chat 1", "messages": [
            {"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]},
    ]))
    db.set_meta("chat_active", "1")
    listing = client.get("/api/bot/chats").json()
    assert listing == {"chats": [{"id": "1", "title": "Chat 1", "message_count": 2}], "active_id": "1"}
    fresh = client.post("/api/bot/chats").json()
    assert fresh["id"] == "2" and fresh["title"] == "Chat 2"
    client.patch("/api/bot/chats/2", json={"title": "Groceries"})
    stored = json.loads(db.get_meta("chat_sessions"))
    assert [c["name"] for c in stored] == ["Chat 1", "Groceries"]
    client.delete("/api/bot/chats/2")
    assert client.delete("/api/bot/chats/1").status_code == 409   # never the last one


def test_bot_without_a_key_streams_the_notice_and_stores_the_turn(client):
    with client.stream("POST", "/api/bot/chats/1/messages",
                       data={"text": "What did I spend?", "period": PERIOD}) as res:
        events = [json.loads(line[6:]) for line in res.iter_lines() if line.startswith("data: ")]
    assert events[0]["type"] == "start"
    assert "No API key" in "".join(e.get("text", "") for e in events if e["type"] == "chunk")
    assert events[-1]["type"] == "done"
    chat = client.get("/api/bot/chats/1").json()
    assert [m["role"] for m in chat["messages"]] == ["user", "assistant"]

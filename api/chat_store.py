"""Chat persistence — the FastAPI-side port of app.py's chat helpers.

Conversations live in the meta table exactly as the Streamlit app kept them,
so chats saved before the migration open unchanged: `chat_sessions` holds a
JSON list of {id, name, messages}, oldest first, and `chat_active` holds the
id of whichever one is selected. Only role and content are stored —
attachment text and image bytes belong to the turn that sent them and would
bloat the row for nothing.
"""
from __future__ import annotations

import json

import db

CHATS_KEY = "chat_sessions"
ACTIVE_CHAT_KEY = "chat_active"
CHAT_LOG_KEY = "chat_log"          # the single log chats replaced; migrated below
CHAT_LOG_MAX = 40
CHAT_NAME_MAX = 40


def _clean_messages(raw) -> list:
    if not isinstance(raw, list):
        return []
    return [{"role": m["role"], "content": m["content"]} for m in raw
            if isinstance(m, dict)
            and m.get("role") in ("user", "assistant")
            and isinstance(m.get("content"), str)]


def load_chats() -> list:
    """Every stored conversation, oldest first. Never returns an empty list —
    there is always at least one chat to be looking at."""
    raw = db.get_meta(CHATS_KEY)
    chats = []
    if raw:
        try:
            stored = json.loads(raw)
        except Exception:
            stored = []
        if isinstance(stored, list):
            for c in stored:
                if isinstance(c, dict) and c.get("id"):
                    chats.append({"id": str(c["id"]),
                                  "name": str(c.get("name") or "Chat")[:CHAT_NAME_MAX],
                                  "messages": _clean_messages(c.get("messages"))})
    if not chats:
        # Anything saved before chats existed becomes the first one, rather
        # than being silently dropped on upgrade.
        legacy = []
        old = db.get_meta(CHAT_LOG_KEY)
        if old:
            try:
                legacy = _clean_messages(json.loads(old))
            except Exception:
                legacy = []
        chats = [{"id": "1", "name": "Chat 1", "messages": legacy}]
    return chats


def save_chats(chats, active=None) -> None:
    trimmed = [{"id": c["id"], "name": c["name"][:CHAT_NAME_MAX],
                "messages": c["messages"][-CHAT_LOG_MAX:]} for c in chats]
    db.set_meta(CHATS_KEY, json.dumps(trimmed))
    if active is not None:
        db.set_meta(ACTIVE_CHAT_KEY, str(active))


def active_chat_id(chats) -> str:
    wanted = db.get_meta(ACTIVE_CHAT_KEY)
    ids = [c["id"] for c in chats]
    return wanted if wanted in ids else ids[0]


def new_chat_name(chats) -> str:
    used = {c["name"] for c in chats}
    n = len(chats) + 1
    while f"Chat {n}" in used:
        n += 1
    return f"Chat {n}"


def find(chats, chat_id: str) -> dict | None:
    return next((c for c in chats if c["id"] == chat_id), None)


def create_chat() -> dict:
    chats = load_chats()
    # One past the highest numeric id in use. Ids that are not numbers
    # (hand-edited, or from a future format) are simply skipped.
    numeric = [int(c["id"]) for c in chats if str(c["id"]).isdigit()]
    fresh = {"id": str(max(numeric, default=0) + 1),
             "name": new_chat_name(chats), "messages": []}
    chats.append(fresh)
    save_chats(chats, fresh["id"])
    return fresh


def append_turn(chat_id: str, user_content: str, reply: str) -> None:
    """Store one settled exchange. A trailing user message is never stored on
    its own: every later load would see an unanswered turn."""
    chats = load_chats()
    chat = find(chats, chat_id)
    if chat is None:
        return
    chat["messages"].extend([{"role": "user", "content": user_content},
                             {"role": "assistant", "content": reply}])
    save_chats(chats)

"""Chat session persistence — the FastAPI-side twin of app.py's save_chat().

Conversations are stored as one JSON blob in the meta table, exactly like the
original: `chat_sessions` holds {id: {id, title, messages, updated}},
`chat_active` holds the id of whichever chat is selected. No new table, no
schema change to db.py.
"""
from __future__ import annotations

import json
import time
import uuid

import db

CHATS_KEY = "chat_sessions"
ACTIVE_CHAT_KEY = "chat_active"


def _load() -> dict:
    raw = db.get_meta(CHATS_KEY)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _save(chats: dict) -> None:
    db.set_meta(CHATS_KEY, json.dumps(chats))


def list_chats() -> list[dict]:
    chats = _load()
    out = [{"id": c["id"], "title": c["title"], "updated": c.get("updated", 0),
            "message_count": len(c.get("messages", []))}
           for c in chats.values()]
    out.sort(key=lambda c: c["updated"], reverse=True)
    return out


def get_active_id() -> str | None:
    active = db.get_meta(ACTIVE_CHAT_KEY)
    chats = _load()
    if active and active in chats:
        return active
    return next(iter(sorted(chats.values(), key=lambda c: c.get("updated", 0),
                            reverse=True)), {}).get("id") if chats else None


def set_active(chat_id: str) -> None:
    db.set_meta(ACTIVE_CHAT_KEY, chat_id)


def get_chat(chat_id: str) -> dict | None:
    return _load().get(chat_id)


def create_chat(title: str | None = None) -> dict:
    chats = _load()
    chat_id = uuid.uuid4().hex
    chat = {"id": chat_id, "title": title or "New chat", "messages": [],
            "updated": time.time()}
    chats[chat_id] = chat
    _save(chats)
    set_active(chat_id)
    return chat


def rename_chat(chat_id: str, title: str) -> None:
    chats = _load()
    if chat_id in chats:
        chats[chat_id]["title"] = title
        chats[chat_id]["updated"] = time.time()
        _save(chats)


def delete_chat(chat_id: str) -> None:
    chats = _load()
    chats.pop(chat_id, None)
    _save(chats)
    if db.get_meta(ACTIVE_CHAT_KEY) == chat_id:
        db.delete_meta(ACTIVE_CHAT_KEY)


def append_messages(chat_id: str, *messages: dict) -> dict:
    chats = _load()
    chat = chats.get(chat_id)
    if chat is None:
        chat = {"id": chat_id, "title": "New chat", "messages": []}
        chats[chat_id] = chat
    chat["messages"].extend(messages)
    chat["updated"] = time.time()
    _save(chats)
    return chat


def clear_messages(chat_id: str) -> None:
    chats = _load()
    if chat_id in chats:
        chats[chat_id]["messages"] = []
        chats[chat_id]["updated"] = time.time()
        _save(chats)

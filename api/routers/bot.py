"""The Finance Bot: chat session CRUD plus a streaming SSE endpoint over
bot.py's own stream_reply(), which is used completely unmodified. The only
new machinery here is plumbing an SSE response out of a callback-based
generator that was designed for a synchronous Streamlit rerun — see the
comment on `_run_stream` for why a second thread/queue layer is necessary.
"""
from __future__ import annotations

import base64
import json
import queue
import threading
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

import bot
import db
import finance

from api import chat_store
from api.deps import get_frames
from api.routers.auth import require_access
from api.secrets_reader import setting
from api.schemas import ChatCreateIn, ChatMessageIn, ChatRenameIn

router = APIRouter(prefix="/api/bot", tags=["bot"], dependencies=[Depends(require_access)])

_STOP_EVENTS: dict[str, threading.Event] = {}


def _api_key() -> str | None:
    return setting("GEMINI_API_KEY")


def _apply_model_override() -> None:
    chosen = setting("GEMINI_MODEL")
    if chosen:
        bot.MODEL = chosen


@router.get("/status")
def status():
    _apply_model_override()
    return {
        "has_api_key": bool(_api_key()),
        "model": bot.MODEL,
        "active_model": bot.ACTIVE_MODEL,
        "requests_last_minute": bot.requests_last_minute(),
    }


@router.get("/chats")
def list_chats():
    return {"chats": chat_store.list_chats(), "active_id": chat_store.get_active_id()}


@router.post("/chats")
def create_chat(body: ChatCreateIn):
    return chat_store.create_chat(body.title)


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    chat = chat_store.get_chat(chat_id)
    if chat is None:
        raise HTTPException(404, "No such chat.")
    return chat


@router.post("/chats/{chat_id}/activate")
def activate_chat(chat_id: str):
    if chat_store.get_chat(chat_id) is None:
        raise HTTPException(404, "No such chat.")
    chat_store.set_active(chat_id)
    return {"ok": True}


@router.patch("/chats/{chat_id}")
def rename_chat(chat_id: str, body: ChatRenameIn):
    chat_store.rename_chat(chat_id, body.title.strip() or "Untitled")
    return {"ok": True}


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    chat_store.delete_chat(chat_id)
    return {"ok": True}


@router.post("/chats/{chat_id}/clear")
def clear_chat(chat_id: str):
    chat_store.clear_messages(chat_id)
    return {"ok": True}


@router.post("/chats/{chat_id}/stop")
def stop_stream(chat_id: str, body: dict):
    stream_id = (body or {}).get("stream_id")
    event = _STOP_EVENTS.get(stream_id)
    if event:
        event.set()
    return {"ok": True}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/chats/{chat_id}/messages")
def send_message(chat_id: str, body: ChatMessageIn):
    # append_messages() creates the chat under this exact id if it doesn't
    # exist yet, so no separate existence check/creation is needed here.
    _apply_model_override()
    api_key = _api_key()

    user_message = {"role": "user", "content": body.text, "timestamp": None}
    if body.attachment_text:
        user_message["attachment_text"] = body.attachment_text
    chat_store.append_messages(chat_id, user_message)

    stream_id = uuid.uuid4().hex
    stop_event = threading.Event()
    _STOP_EVENTS[stream_id] = stop_event

    frames = get_frames()
    period = body.period or date.today().strftime("%Y-%m")
    series = finance.month_series(frames)
    snap = finance.snapshot(frames, period)
    bot.bind_frames(frames)

    images = [{"data": base64.b64decode(im.data_base64), "mime_type": im.mime_type}
              for im in body.images]

    def event_gen():
        collected: list[str] = []
        outer_q: "queue.Queue" = queue.Queue()

        def runner():
            try:
                if not api_key:
                    outer_q.put(("chunk", "**No API key.** Add `GEMINI_API_KEY` to "
                                          "`.streamlit/secrets.toml` and I can read and "
                                          "write your ledgers."))
                    return
                system_prompt = bot.system_context(snap, frames, series)
                history = bot.build_history(chat_store.get_chat(chat_id)["messages"][:-1])
                parts = bot.build_parts(body.text, images)
                for piece in bot.stream_reply(
                    api_key, system_prompt, history, parts,
                    should_stop=stop_event.is_set,
                    on_status=lambda note: outer_q.put(("status", note)),
                ):
                    outer_q.put(("chunk", piece))
            finally:
                outer_q.put(("done", None))

        threading.Thread(target=runner, daemon=True).start()

        try:
            yield _sse({"type": "start", "stream_id": stream_id})
            while True:
                kind, payload = outer_q.get()
                if kind == "chunk":
                    collected.append(payload)
                    yield _sse({"type": "chunk", "text": payload})
                elif kind == "status":
                    yield _sse({"type": "status", "text": payload})
                else:
                    break
        finally:
            text = "".join(collected).strip()
            if text:
                chat_store.append_messages(chat_id, {"role": "assistant", "content": text})
            _STOP_EVENTS.pop(stream_id, None)
        yield _sse({"type": "done", "active_model": bot.ACTIVE_MODEL})

    return StreamingResponse(event_gen(), media_type="text/event-stream")


def _today_key() -> str:
    return date.today().strftime("%Y-%m")


@router.post("/digest/generate")
def generate_digest():
    """One attempt per calendar month, success or failure — marking the
    period up front (before the network call) means a Gemini failure doesn't
    retry on every board load for the rest of it. Mirrors app.py's own
    once-a-month digest job exactly."""
    if db.get_meta("digest_period") == _today_key():
        return {"generated": False, "reason": "already attempted this month",
                "text": db.get_meta("digest_text")}
    _apply_model_override()
    api_key = _api_key()
    db.set_meta("digest_period", _today_key())
    if not api_key:
        return {"generated": False, "reason": "no api key"}

    frames = get_frames()
    last_period = finance.shift_month(_today_key(), -1)
    series = finance.month_series(frames)
    snap = finance.snapshot(frames, last_period)
    bot.bind_frames(frames)
    text = "".join(bot.stream_reply(
        api_key, bot.system_context(snap, frames, series), [],
        bot.build_parts(
            "Summarize last month's finances in 3-4 short, concrete sentences "
            "for a quick glance: total spent, total earned, where most money "
            "went, and whether it was a good month financially. Use the real "
            "figures already given to you above — never invent a number."),
    ))
    db.set_meta("digest_text", text.strip())
    return {"generated": True, "text": text.strip()}

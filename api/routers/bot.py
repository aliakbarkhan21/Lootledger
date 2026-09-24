"""The Finance Bot: chat session CRUD plus a streaming SSE endpoint over
bot.py's own stream_reply(), which is used completely unmodified. The only
new machinery here is plumbing an SSE response out of a callback-based
generator that was designed for a synchronous Streamlit rerun — see
`send_message` for why a second thread/queue layer is necessary.
"""
from __future__ import annotations

import json
import queue
import threading
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

import bot
import db
import finance

from api import chat_store
from api.attachments import ACCEPTED, cap_attachment_text, downscale_image
from api.deps import board_context
from api.routers.auth import require_access
from api.schemas import ChatRenameIn
from api.secrets_reader import setting

router = APIRouter(prefix="/api/bot", tags=["bot"], dependencies=[Depends(require_access)])

_STOP_EVENTS: dict[str, threading.Event] = {}

NO_KEY_REPLY = ("**No API key.** Add `GEMINI_API_KEY` to `.streamlit/secrets.toml` "
                "and I can read and write your ledgers.")


def _api_key() -> str | None:
    return setting("GEMINI_API_KEY")


def _apply_model_override() -> None:
    # Swapping models is config, not code: GEMINI_MODEL in secrets.toml takes
    # effect from the next message.
    chosen = setting("GEMINI_MODEL")
    if chosen:
        bot.MODEL = chosen


def _summary(chat: dict) -> dict:
    return {"id": chat["id"], "title": chat["name"], "message_count": len(chat["messages"])}


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
    chats = chat_store.load_chats()
    return {"chats": [_summary(c) for c in chats], "active_id": chat_store.active_chat_id(chats)}


@router.post("/chats")
def create_chat():
    fresh = chat_store.create_chat()
    return {"id": fresh["id"], "title": fresh["name"], "messages": []}


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    chat = chat_store.find(chat_store.load_chats(), chat_id)
    if chat is None:
        raise HTTPException(404, "No such chat.")
    return {"id": chat["id"], "title": chat["name"], "messages": chat["messages"]}


@router.post("/chats/{chat_id}/activate")
def activate_chat(chat_id: str):
    chats = chat_store.load_chats()
    if chat_store.find(chats, chat_id) is None:
        raise HTTPException(404, "No such chat.")
    db.set_meta(chat_store.ACTIVE_CHAT_KEY, chat_id)
    return {"ok": True}


@router.patch("/chats/{chat_id}")
def rename_chat(chat_id: str, body: ChatRenameIn):
    label = body.title.strip()
    if not label:
        raise HTTPException(400, "A chat needs a name.")
    chats = chat_store.load_chats()
    chat = chat_store.find(chats, chat_id)
    if chat is None:
        raise HTTPException(404, "No such chat.")
    chat["name"] = label[:chat_store.CHAT_NAME_MAX]
    chat_store.save_chats(chats)
    return {"ok": True}


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    chats = chat_store.load_chats()
    # The last chat is never deleted — the panel would have nothing to show.
    if len(chats) == 1:
        raise HTTPException(409, "This is your only chat, so it cannot be deleted. "
                                 "Clear chat empties it instead.")
    remaining = [c for c in chats if c["id"] != chat_id]
    chat_store.save_chats(remaining, remaining[0]["id"])
    return {"ok": True, "active_id": remaining[0]["id"]}


@router.post("/chats/{chat_id}/clear")
def clear_chat(chat_id: str):
    chats = chat_store.load_chats()
    chat = chat_store.find(chats, chat_id)
    if chat is not None:
        chat["messages"] = []
        chat_store.save_chats(chats)
    return {"ok": True}


@router.post("/stop/{stream_id}")
def stop_stream(stream_id: str):
    event = _STOP_EVENTS.get(stream_id)
    if event:
        event.set()
    return {"ok": True}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    text: str = Form(""),
    period: str | None = Form(None),
    files: list[UploadFile] = File(default_factory=list),
    ctx=Depends(board_context),
):
    frames, _currency = ctx
    _apply_model_override()
    api_key = _api_key()

    chats = chat_store.load_chats()
    chat = chat_store.find(chats, chat_id)
    if chat is None:
        raise HTTPException(404, "No such chat.")
    history_source = list(chat["messages"])

    attachment_text, images, names = "", [], []
    for handle in files:
        name = handle.filename or "file"
        if name.rsplit(".", 1)[-1].lower() not in ACCEPTED:
            continue
        names.append(name)
        try:
            raw = await handle.read()
            if name.lower().endswith(".csv"):
                attachment_text += cap_attachment_text(name, raw)
            else:
                data, mime = downscale_image(raw, handle.content_type or "image/jpeg")
                images.append({"mime_type": mime, "data": data})
        except Exception:
            pass

    text = (text or "").strip()
    shown = text
    if names:
        shown = (shown + "\n\n" if shown else "") + f"*Attached: {', '.join(names)}*"
    if not shown:
        raise HTTPException(400, "Nothing to send.")

    key = period or date.today().strftime("%Y-%m")
    if key.lower() in ("all", "all_time"):
        key = finance.ALL_TIME
    series = finance.month_series(frames)
    snap = finance.snapshot(frames, key)
    bot.bind_frames(frames)

    stream_id = uuid.uuid4().hex
    stop_event = threading.Event()
    _STOP_EVENTS[stream_id] = stop_event

    prompt = shown
    if attachment_text:
        prompt += f"\n\n[attached file contents]\n{attachment_text}"

    # bot.stream_reply reports progress (rate-limit backoff, model fallback)
    # through an on_status callback that fires synchronously *inside* its own
    # generator loop. A second thread drains it into one queue alongside the
    # text chunks so both reach the browser, in order, on the same stream.
    def event_gen():
        collected: list[str] = []
        outer_q: "queue.Queue" = queue.Queue()
        failure: list[str] = []

        def runner():
            try:
                if not api_key:
                    outer_q.put(("chunk", NO_KEY_REPLY))
                    return
                for piece in bot.stream_reply(
                    api_key,
                    bot.system_context(snap, frames, series),
                    bot.build_history(history_source),
                    bot.build_parts(prompt, images),
                    should_stop=stop_event.is_set,
                    on_status=lambda note: outer_q.put(("status", note)),
                ):
                    outer_q.put(("chunk", piece))
            except Exception as exc:  # anything raised building the prompt
                failure.append(f"_Something went wrong talking to the bot: {exc}_")
            finally:
                outer_q.put(("done", None))

        threading.Thread(target=runner, daemon=True).start()
        reply = ""
        try:
            yield _sse({"type": "start", "stream_id": stream_id, "user": shown})
            while True:
                kind, payload = outer_q.get()
                if kind == "chunk":
                    collected.append(payload)
                    yield _sse({"type": "chunk", "text": payload})
                elif kind == "status":
                    yield _sse({"type": "status", "text": payload})
                else:
                    break
            reply = "".join(collected).strip()
            if failure:
                reply = failure[0]
                yield _sse({"type": "chunk", "text": reply})
        finally:
            if not reply:
                reply = "".join(collected).strip() or (
                    "_Stopped._" if stop_event.is_set() else "_No reply._")
            chat_store.append_turn(chat_id, shown, reply)
            _STOP_EVENTS.pop(stream_id, None)
        yield _sse({"type": "done", "reply": reply, "active_model": bot.ACTIVE_MODEL})

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _today_key() -> str:
    return date.today().strftime("%Y-%m")


@router.post("/digest/generate")
def generate_digest(ctx=Depends(board_context)):
    """One attempt per calendar month, success or failure — marking the
    period up front (before the network call) means a Gemini failure doesn't
    retry on every board load for the rest of it. Mirrors app.py's own
    once-a-month digest job."""
    frames, _currency = ctx
    if db.get_meta("digest_period") == _today_key():
        return {"generated": False, "reason": "already attempted this month",
                "text": db.get_meta("digest_text")}
    _apply_model_override()
    api_key = _api_key()
    db.set_meta("digest_period", _today_key())
    if not api_key:
        db.delete_meta("digest_text")
        return {"generated": False, "reason": "no api key"}

    last_period = finance.shift_month(_today_key(), -1)
    series = finance.month_series(frames)
    snap = finance.snapshot(frames, last_period)
    bot.bind_frames(frames)
    try:
        text = "".join(bot.stream_reply(
            api_key, bot.system_context(snap, frames, series), [],
            bot.build_parts(
                "Summarize last month's finances in 3-4 short, concrete sentences "
                "for a quick glance: total spent, total earned, where most money "
                "went, and whether it was a good month financially. Use the real "
                "figures already given to you above — never invent a number."),
        ))
        db.set_meta("digest_text", text.strip())
    except Exception:
        db.delete_meta("digest_text")
        return {"generated": False, "reason": "failed"}
    return {"generated": True, "text": text.strip()}

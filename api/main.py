"""Loot Ledger API — FastAPI wrapper around the untouched Python core
(db.py, finance.py, bot.py, importer.py, demo.py, rates.py). Run with:

    uvicorn api.main:app --reload

from the repo root — or, normally, `python start.py`, which builds the page
if needed and serves it from this same process.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import db

from api import access_policy
from api.routers import auth, bot, board, budgets, importer, ledgers, recurring, settings

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    access_policy.seed_demo_if_empty()
    yield


app = FastAPI(title="Loot Ledger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(board.router)
app.include_router(ledgers.router)
app.include_router(budgets.router)
app.include_router(recurring.router)
app.include_router(settings.router)
app.include_router(importer.router)
app.include_router(bot.router)


@app.get("/api/health")
def health():
    return {"ok": True}


# Production/"one command" mode: if the frontend has been built, serve it
# straight from this same process so there's a single server to run. In dev,
# the Vite dev server (with its proxy to this API) is used instead and this
# mount simply won't find anything at that path.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")

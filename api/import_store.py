"""In-memory holding pen for an import in progress.

A local single-user app doesn't need a real upload service: the raw bytes,
the parsed DataFrame, and the per-ledger detected rows just need to survive
between the upload / parse / detect / commit round trip in the Import tab.
Cleared explicitly when the frontend is done with an upload, or left to be
overwritten — there's no multi-tenant risk here to guard against.
"""
from __future__ import annotations

import uuid

_UPLOADS: dict[str, dict] = {}


class UploadedBytes:
    """Minimal stand-in for a Streamlit UploadedFile — the only surface
    importer.py's read_csv/read_excel/excel_sheets actually use."""

    def __init__(self, name: str, data: bytes):
        self.name = name
        self._data = data

    def getvalue(self) -> bytes:
        return self._data


def new_upload(name: str, data: bytes) -> str:
    upload_id = uuid.uuid4().hex
    _UPLOADS[upload_id] = {"name": name, "data": data, "df": None, "ledgers": {}}
    return upload_id


def get(upload_id: str) -> dict | None:
    return _UPLOADS.get(upload_id)


def set_df(upload_id: str, df) -> None:
    _UPLOADS[upload_id]["df"] = df


def set_ledger_rows(upload_id: str, ledger: str, rows: list[dict], mapping: dict,
                     problems: list[str]) -> None:
    _UPLOADS[upload_id]["ledgers"][ledger] = {
        "rows": rows, "mapping": mapping, "problems": problems,
    }


def drop(upload_id: str) -> None:
    _UPLOADS.pop(upload_id, None)

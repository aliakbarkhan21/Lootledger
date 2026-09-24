"""CSV/Excel import: upload -> parse -> auto-detect (or hand-mapped) per
ledger -> commit. Every parsing/scoring/row-building call goes straight into
importer.py, unchanged; this router only manages the upload/session plumbing
Streamlit's file_uploader used to do for free.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

import db
import demo
import importer as importer_lib

from api.deps import currency_context
from api.import_store import UploadedBytes, drop, get, new_upload, set_df, set_ledger_rows
from api.routers.auth import require_access

router = APIRouter(prefix="/api/import", tags=["import"], dependencies=[Depends(require_access)])


def _wrapped(entry: dict) -> UploadedBytes:
    return UploadedBytes(entry["name"], entry["data"])


def _section_payload(rows: list, mapping: dict, problems: list) -> dict:
    # preview() formats amounts with finance.money, so callers depend on
    # currency_context to read the file in the board's display currency.
    preview_df = importer_lib.preview(rows)
    return {
        "mapping": mapping, "problems": problems, "row_count": len(rows),
        "total": float(sum(r["amount"] for r in rows)),
        "preview": preview_df.to_dict("records") if not preview_df.empty else [],
    }


@router.get("/schemas")
def schemas():
    return {
        "none_label": importer_lib.NONE_LABEL,
        "upload_types": importer_lib.UPLOAD_TYPES,
        "schemas": {
            key: {"label": spec["label"],
                  "fields": {f: {"required": bool(v["required"])} for f, v in spec["fields"].items()}}
            for key, spec in importer_lib.SCHEMAS.items()
        },
    }


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    data = await file.read()
    upload_id = new_upload(file.filename or "upload", data)
    wrapped = _wrapped(get(upload_id))
    if importer_lib._is_excel(wrapped.name):
        sheets = importer_lib.excel_sheets(wrapped)
        return {"upload_id": upload_id, "is_excel": True, "sheets": sheets}
    return {"upload_id": upload_id, "is_excel": False, "sheets": []}


@router.post("/parse")
def parse(upload_id: str, sheet: str | None = None):
    entry = get(upload_id)
    if not entry:
        raise HTTPException(404, "Unknown upload.")
    try:
        df = importer_lib.read_table(_wrapped(entry), sheet)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    set_df(upload_id, df)
    return {"columns": list(df.columns), "row_count": len(df)}


@router.post("/detect")
def detect(upload_id: str, prefer: str | None = None, currency=Depends(currency_context)):
    entry = get(upload_id)
    if not entry or entry["df"] is None:
        raise HTTPException(404, "Upload has not been parsed yet.")
    sections = importer_lib.detect_sections(entry["df"], prefer)
    out = {}
    for ledger, section in sections.items():
        set_ledger_rows(upload_id, ledger, section["rows"], section["mapping"], section["problems"])
        out[ledger] = _section_payload(section["rows"], section["mapping"], section["problems"])
    return out


@router.post("/mapping/suggest")
def suggest_mapping(upload_id: str, ledger: str):
    entry = get(upload_id)
    if not entry or entry["df"] is None:
        raise HTTPException(404, "Upload has not been parsed yet.")
    if ledger not in importer_lib.SCHEMAS:
        raise HTTPException(404, f"No such ledger schema: {ledger!r}")
    return importer_lib.suggest_mapping(entry["df"], ledger)


@router.post("/mapping")
def apply_mapping(upload_id: str, ledger: str, mapping: dict[str, str] = Body(...),
                  currency=Depends(currency_context)):
    entry = get(upload_id)
    if not entry or entry["df"] is None:
        raise HTTPException(404, "Upload has not been parsed yet.")
    if ledger not in importer_lib.SCHEMAS:
        raise HTTPException(404, f"No such ledger schema: {ledger!r}")
    rows, problems = importer_lib.build_rows(entry["df"], ledger, mapping)
    set_ledger_rows(upload_id, ledger, rows, mapping, problems)
    return _section_payload(rows, mapping, problems)


@router.post("/commit/{upload_id}/{ledger}")
def commit_ledger(upload_id: str, ledger: str, replace: bool = False):
    entry = get(upload_id)
    if not entry:
        raise HTTPException(404, "Unknown upload.")
    section = entry["ledgers"].get(ledger)
    if not section:
        raise HTTPException(400, f"{ledger!r} has not been detected/mapped for this upload.")
    count = importer_lib.commit(ledger, section["rows"], replace)
    db.delete_meta(demo.FLAG)
    return {"imported": count}


@router.delete("/{upload_id}")
def discard(upload_id: str):
    drop(upload_id)
    return {"ok": True}

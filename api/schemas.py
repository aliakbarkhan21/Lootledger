"""Request bodies for the write endpoints.

Amounts on the way IN are always in whatever currency the board is currently
displaying (matching the old sidebar form's behavior exactly) and get
converted to PKR with deps.to_pkr() inside the router. Amounts on the way OUT
of the API are always raw PKR, alongside a `currency` block, so the frontend
has one single place (a `formatMoney` util) doing the PKR -> display-currency
conversion — the TS mirror of finance.money().
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Kind = Literal["cash", "covered", "owed"]


class ExpenseIn(BaseModel):
    date: str
    description: str
    category: str
    amount: float


class TransportIn(BaseModel):
    date: str
    amount: float


class IncomeIn(BaseModel):
    date: str
    source: str
    amount: float


class LentIn(BaseModel):
    date: str
    person: str
    amount: float
    kind: Kind = "cash"


class BorrowedIn(BaseModel):
    date: str
    lender: str
    amount: float
    kind: Kind = "cash"


class RowUpdate(BaseModel):
    """Partial update for one ledger row. Only fields present are changed;
    the router checks each key against db.EDITABLE for that table."""
    date: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    person: Optional[str] = None
    lender: Optional[str] = None
    amount: Optional[float] = None
    paid_back: Optional[bool] = None
    settled_date: Optional[str] = None
    kind: Optional[Kind] = None


class SettleIn(BaseModel):
    settled: bool
    date: Optional[str] = None


class BudgetIn(BaseModel):
    category: str
    monthly_cap: float


class RecurringIn(BaseModel):
    label: str
    kind: Literal["expense", "income"]
    category: Optional[str] = None
    amount: float
    day_of_month: int = Field(ge=1, le=31)


class MergeCategoryIn(BaseModel):
    from_category: str
    to_category: str


class OpeningBalanceIn(BaseModel):
    value: float


class BoolFlagIn(BaseModel):
    value: bool


class CurrencyIn(BaseModel):
    code: str


class RestoreIn(BaseModel):
    path: str


class LoginIn(BaseModel):
    password: str


class ChatCreateIn(BaseModel):
    title: Optional[str] = None


class ChatRenameIn(BaseModel):
    title: str


class ImageAttachmentIn(BaseModel):
    data_base64: str
    mime_type: str = "image/jpeg"


class ChatMessageIn(BaseModel):
    text: str = ""
    images: list[ImageAttachmentIn] = Field(default_factory=list)
    attachment_text: Optional[str] = None
    # Whatever period is open on screen right now, so the bot's system
    # context ("ON SCREEN: ...") matches what the user is actually looking
    # at rather than always the calendar-current month.
    period: Optional[str] = None


class ImportCommitIn(BaseModel):
    ledger: str
    rows: list[dict]
    replace: bool = False


class ImportDetectIn(BaseModel):
    upload_id: str
    sheet: Optional[str] = None
    prefer: Optional[str] = None

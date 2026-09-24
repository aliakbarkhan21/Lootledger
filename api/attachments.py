"""Chat attachment caps, moved over from app.py unchanged.

An uncapped receipt photo or a multi-thousand-row CSV would otherwise be
re-sent to Gemini at full size with every turn that carries it.
"""
from __future__ import annotations

import io

_ATTACHMENT_MAX_LINES = 200
_ATTACHMENT_MAX_CHARS = 20_000
_IMAGE_MAX_DIM = 1600
_IMAGE_JPEG_QUALITY = 82

ACCEPTED = ("csv", "png", "jpg", "jpeg")


def cap_attachment_text(name: str, raw: bytes) -> str:
    text = raw.decode("utf-8", "ignore")
    lines = text.splitlines()
    truncated = len(lines) > _ATTACHMENT_MAX_LINES
    text = "\n".join(lines[:_ATTACHMENT_MAX_LINES])
    if len(text) > _ATTACHMENT_MAX_CHARS:
        text = text[:_ATTACHMENT_MAX_CHARS]
        truncated = True
    note = (f"\n[...truncated to the first {_ATTACHMENT_MAX_LINES} lines...]"
            if truncated else "")
    return f"\n=== {name} ===\n{text}{note}\n"


def downscale_image(raw: bytes, mime_type: str) -> tuple[bytes, str]:
    """Cap dimensions and re-encode a photo before it is sent. Falls back to
    the original bytes if Pillow is unavailable or the file cannot be decoded
    as an image."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(raw))
        img.load()
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((_IMAGE_MAX_DIM, _IMAGE_MAX_DIM))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=_IMAGE_JPEG_QUALITY)
        return out.getvalue(), "image/jpeg"
    except Exception:
        return raw, mime_type or "image/jpeg"

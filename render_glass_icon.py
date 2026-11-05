"""
Renders the Glass mark from static/glass-icon-source.html and writes every
shipped icon.

    python render_glass_icon.py            write everything
    python render_glass_icon.py --preview  only write a contact sheet to look at

Each size range gets the variant drawn for it (see the comment at the top of
the source page) rather than one 512px picture scaled to everything: the
frosted pane's edge and the pair of italic Ls turn to mush below 48px, so the
small sizes are drawn heavier and the smallest drop to a single L.

The page is screenshotted at 512px with a transparent background and filtered
down with Lanczos. The .ico container is make_icon.write_ico's, entry by entry,
so the 16px slot gets the 16px drawing rather than the 256px one squeezed.

The Windows shortcut's icon goes to a NEW file name, glass-icon.ico, for the
reason make_icon.py gives: the shell caches a shortcut's icon against its
(path, index) and will not notice the file underneath changing. Chrome keeps
its own favicon cache keyed by URL in the same way, so frontend/index.html
and the manifest link the icons with a ?v= tag; change that tag whenever the
mark changes.
"""
from __future__ import annotations

import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
SOURCE = HERE / "static" / "glass-icon-source.html"
STATIC = HERE / "static"
PUBLIC = HERE / "frontend" / "public"
ICO = STATIC / "glass-icon.ico"

ICO_SIZES = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)


def variant_for(size: int) -> str:
    if size <= 24:
        return "tiny"
    if size <= 48:
        return "simple"
    return ""


def render(variants) -> dict[str, Image.Image]:
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 512, "height": 512})
        page.goto(SOURCE.resolve().as_uri())
        page.evaluate("document.fonts.ready")
        for v in variants:
            # The tiny drawing is one L: two italic Ls at 16px are a smudge.
            page.evaluate(
                "(v) => { document.getElementById('icon').className = 'icon ' + v;"
                " document.querySelector('.mark span').textContent ="
                " v === 'tiny' ? 'L' : 'LL' }", v)
            png = page.locator("#icon").screenshot(omit_background=True)
            out[v] = Image.open(BytesIO(png)).convert("RGBA")
        browser.close()
    return out


def sized(drawings, size: int, bleed: bool = False) -> Image.Image:
    key = "bleed" if bleed else variant_for(size)
    return drawings[key].resize((size, size), Image.LANCZOS)


def write_ico(drawings, out: Path) -> None:
    payloads = []
    for s in ICO_SIZES:
        buf = BytesIO()
        sized(drawings, s).save(buf, format="PNG", optimize=True)
        payloads.append((s, buf.getvalue()))
    header = struct.pack("<HHH", 0, 1, len(payloads))
    offset = len(header) + 16 * len(payloads)
    entries, blobs = [], []
    for s, data in payloads:
        dim = 0 if s >= 256 else s
        entries.append(struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset))
        blobs.append(data)
        offset += len(data)
    out.write_bytes(header + b"".join(entries) + b"".join(blobs))


def contact_sheet(drawings, out: Path) -> None:
    """Every size on a dark and a light desktop, at 1:1, to judge by eye."""
    sizes = (256, 128, 64, 48, 32, 24, 16)
    pad = 24
    w = sum(sizes) + pad * (len(sizes) + 1)
    h = (256 + pad * 2) * 2
    sheet = Image.new("RGBA", (w, h), (32, 36, 40, 255))
    sheet.paste((236, 238, 232, 255), (0, h // 2, w, h))
    for row in range(2):
        x = pad
        for s in sizes:
            img = sized(drawings, s)
            y = row * (h // 2) + pad + (256 - s)
            sheet.alpha_composite(img, (x, y))
            x += s + pad
    sheet.save(out)


def main() -> int:
    drawings = render(["", "simple", "tiny", "bleed"])
    if "--preview" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--preview") + 1]) if len(sys.argv) > 2 else HERE / "icon-preview.png"
        contact_sheet(drawings, out)
        drawings[""].save(out.with_name(out.stem + "-512.png"))
        print(f"  wrote {out}")
        return 0

    pngs = {
        "favicon-16.png": 16,
        "favicon-32.png": 32,
        "favicon-64.png": 64,
        "icon-192.png": 192,
        "icon-512.png": 512,
    }
    for name, s in pngs.items():
        sized(drawings, s).save(PUBLIC / name, format="PNG", optimize=True)
        print(f"  wrote frontend/public/{name}")

    # iOS cuts its own mask and wants a full-bleed opaque square.
    sized(drawings, 180, bleed=True).save(PUBLIC / "apple-touch-icon.png", format="PNG", optimize=True)
    print("  wrote frontend/public/apple-touch-icon.png  [square, iOS masks it]")

    # Maskable: the square bleed drawing as it is. The LL already sits well
    # inside the middle 80% a launcher keeps, and only the pane's outer
    # corners fall in the crop -- insetting a second rounded tile into it
    # reads as a frame inside a frame.
    m = sized(drawings, 512, bleed=True)
    m.save(PUBLIC / "icon-512-maskable.png", format="PNG", optimize=True)
    print("  wrote frontend/public/icon-512-maskable.png")

    write_ico(drawings, ICO)
    print(f"  wrote static/{ICO.name}  ({', '.join(map(str, ICO_SIZES))})")
    # The browser's own fallback (history, bookmarks, a missing <link>).
    write_ico(drawings, PUBLIC / "favicon.ico")
    print("  wrote frontend/public/favicon.ico")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

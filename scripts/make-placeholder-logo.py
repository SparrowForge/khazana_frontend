"""
Generate a TYPOGRAPHIC stand-in logo + icons for Khazana Mithai.

Why this exists
---------------
The real artwork is a red wordmark with a decorative motif between the two
words. That motif is hand-drawn and cannot be honestly reproduced from a
low-resolution reference, so this script deliberately does NOT attempt to fake
it. What it produces is plainly typographic:

    public/logo.png    KHAZANA MITHAI  set in heavy type, brand red
    src/app/icon.png   a square "KM" monogram
    src/app/apple-icon.png

That is enough for the app to look finished and consistent everywhere, without
passing off an invented mark as the company's own.

Replacing it with the real artwork
----------------------------------
    python scripts/make-icons.py --from <path-to-real-logo.png>

That overwrites public/logo.png and re-cuts the icons from the real motif. The
Logo component measures whatever it finds, so no code changes are needed.

Requires Pillow.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required:  python -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "public" / "logo.png"
ICON = ROOT / "src" / "app" / "icon.png"
APPLE_ICON = ROOT / "src" / "app" / "apple-icon.png"

# Sampled from the supplied artwork — a vivid pillar-box red.
RED = (237, 28, 36, 255)

# Heaviest widely-available faces first; the wordmark wants weight.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/ariblk.ttf",    # Arial Black
    "C:/Windows/Fonts/seguibl.ttf",   # Segoe UI Black
    "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
    "C:/Windows/Fonts/segoeuib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    print("  ! no bold TrueType font found — falling back to PIL's bitmap default")
    return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int, int, int]:
    """(width, height, offset_x, offset_y) — offsets matter because TrueType
    bounding boxes do not start at the origin."""
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1], box[0], box[1]


def make_wordmark() -> None:
    """KHAZANA MITHAI on transparency, tightly cropped, ~5:1 like the original."""
    font = load_font(120)
    scratch = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(scratch)
    text = "KHAZANA MITHAI"
    w, h, ox, oy = text_size(d, text, font)

    pad = 24
    img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Slight negative tracking would need per-glyph drawing; the stock spacing
    # reads cleanly enough at this weight.
    draw.text((pad - ox, pad - oy), text, font=font, fill=RED)

    LOGO.parent.mkdir(parents=True, exist_ok=True)
    img.save(LOGO)
    print(f"  wrote {LOGO.relative_to(ROOT)}  {img.width}x{img.height}  ({img.width / img.height:.1f}:1)")


def make_monogram() -> None:
    """Square KM monogram — a wordmark is illegible at favicon sizes."""
    side = 512
    img = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded red plate, so the mark reads on both light and dark tab bars.
    draw.rounded_rectangle([0, 0, side - 1, side - 1], radius=int(side * 0.22), fill=RED)

    font = load_font(int(side * 0.46))
    w, h, ox, oy = text_size(draw, "KM", font)
    draw.text(((side - w) / 2 - ox, (side - h) / 2 - oy), "KM", font=font, fill=(255, 255, 255, 255))

    ICON.parent.mkdir(parents=True, exist_ok=True)
    img.save(ICON)
    img.resize((180, 180), Image.LANCZOS).save(APPLE_ICON)
    print(f"  wrote {ICON.relative_to(ROOT)}  512x512")
    print(f"  wrote {APPLE_ICON.relative_to(ROOT)}  180x180")


if __name__ == "__main__":
    print("Generating typographic stand-in assets (NOT the real motif):")
    make_wordmark()
    make_monogram()
    print("\nReplace with the real artwork any time:")
    print("  python scripts/make-icons.py --from <path-to-real-logo.png>")

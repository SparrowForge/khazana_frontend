"""
Generate the square app icons from the wide Khazana Mithai wordmark.

The wordmark is roughly 5:1 ("KHAZANA" + motif + "MITHAI"). Squeezed into a
32x32 favicon it becomes an illegible smear, so the icons are cut from the
decorative motif in the middle, which stays recognisable at any size.

Usage
-----
    python scripts/make-icons.py --from ~/Downloads/logo.png   # copy in + build
    python scripts/make-icons.py                 # public/logo.png already in place
    python scripts/make-icons.py --center 0.52   # nudge it by hand
    python scripts/make-icons.py --preview       # write the crop only, no icons

For a crop taken by hand from a screenshot (white background, a neighbouring
letter caught at the edge), combine the clean-up flags:

    python scripts/make-icons.py --from crop.png --dewhite --isolate --trim

Reads   public/logo.png
Writes  src/app/icon.png        (512x512, browser tab)
        src/app/apple-icon.png  (180x180, iOS home screen)

If public/logo.png is already square (the motif on its own), it is simply
resized — the crop below is only needed when starting from the wide wordmark.

How the motif is found
----------------------
The letters all sit between the same baseline and cap height. The motif has
flourishes that overshoot both, so its columns have a taller ink extent than any
letter column. Scanning column by column for that overshoot locates it without
hard-coded pixel coordinates, which would break the moment the artwork is
re-exported at a different size.

Requires Pillow (already available):  python -m pip install Pillow
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required:  python -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "logo.png"
ICON = ROOT / "src" / "app" / "icon.png"
APPLE_ICON = ROOT / "src" / "app" / "apple-icon.png"
PREVIEW = ROOT / "public" / "logo-motif.png"

# A pixel counts as ink if it is opaque enough AND not near-white. Both tests are
# needed: the artwork may be exported on transparency OR on a white plate.
ALPHA_MIN = 40
WHITE_MAX = 235


def ink_mask(img: Image.Image) -> list[list[bool]]:
    """Per-pixel ink map, indexed [x][y]."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    mask = [[False] * h for _ in range(w)]
    for x in range(w):
        col = mask[x]
        for y in range(h):
            r, g, b, a = px[x, y]
            if a >= ALPHA_MIN and min(r, g, b) < WHITE_MAX:
                col[y] = True
    return mask


def column_extents(mask: list[list[bool]]) -> list[tuple[int, int] | None]:
    """(top, bottom) of the ink in each column, or None for a blank column."""
    out: list[tuple[int, int] | None] = []
    for col in mask:
        ys = [y for y, on in enumerate(col) if on]
        out.append((ys[0], ys[-1]) if ys else None)
    return out


def find_motif(extents: list[tuple[int, int] | None]) -> tuple[int, int]:
    """Horizontal span of the motif, as (x0, x1)."""
    inked = [(x, e) for x, e in enumerate(extents) if e]
    if not inked:
        sys.exit("logo.png appears to be blank — nothing to crop.")

    heights = sorted(e[1] - e[0] for _, e in inked)
    median = heights[len(heights) // 2]
    # The motif overshoots the letters; 1.15x the median column height is a
    # comfortable threshold that ignores ordinary ascenders/descenders.
    tall = [x for x, e in inked if (e[1] - e[0]) > median * 1.15]

    if not tall:
        # No clear overshoot (a flat motif, or a re-drawn logo). Fall back to the
        # widest horizontal gap between ink — the motif sits in a gap between the
        # two words, so the middle of the run bracketed by the two largest gaps
        # is still a decent guess.
        print("  ! no clear motif overshoot; falling back to the centre of the mark")
        xs = [x for x, _ in inked]
        mid = (xs[0] + xs[-1]) // 2
        span = (xs[-1] - xs[0]) // 8
        return mid - span, mid + span

    # Keep the largest contiguous run of tall columns; stray tall pixels
    # elsewhere (a stged descender, a stray dot) must not widen the crop.
    runs: list[list[int]] = [[tall[0]]]
    for x in tall[1:]:
        if x - runs[-1][-1] <= 3:
            runs[-1].append(x)
        else:
            runs.append([x])
    run = max(runs, key=len)
    return run[0], run[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--center", type=float, default=None,
                    help="override the motif centre as a fraction of width (0-1)")
    ap.add_argument("--pad", type=float, default=0.12,
                    help="breathing room around the motif, as a fraction of the crop (default 0.12)")
    ap.add_argument("--preview", action="store_true",
                    help="write public/logo-motif.png only, so the crop can be eyeballed first")
    ap.add_argument("--dewhite", action="store_true",
                    help="make a white background transparent (for a screenshot crop, "
                         "which would otherwise show a white box on dark tab bars)")
    ap.add_argument("--isolate", action="store_true",
                    help="keep only the largest connected shape, dropping detached "
                         "fragments (e.g. a neighbouring letter caught in the crop)")
    ap.add_argument("--trim", action="store_true",
                    help="crop away empty margins, then re-pad to a square")
    ap.add_argument("--from", dest="src", default=None,
                    help="path to the logo saved elsewhere (e.g. ~/Downloads/logo.png); "
                         "it is copied to public/logo.png first")
    ap.add_argument("--icons-only", action="store_true",
                    help="build the icons from --from WITHOUT replacing public/logo.png "
                         "(use when the favicon art differs from the wordmark)")
    args = ap.parse_args()

    # Saving the artwork straight into public/ is easy to get wrong, so allow it
    # to be picked up from wherever the browser put it.
    source_path = SOURCE
    if args.src:
        src = Path(args.src).expanduser()
        if not src.exists():
            sys.exit(f"Not found: {src}")
        if args.icons_only:
            # The favicon is cut from different art than the wordmark, so the
            # logo on disk must survive untouched.
            source_path = src
            print(f"reading {src} (icons only — public/logo.png left as-is)")
        else:
            SOURCE.parent.mkdir(parents=True, exist_ok=True)
            Image.open(src).convert("RGBA").save(SOURCE)
            print(f"copied {src} -> {SOURCE.relative_to(ROOT)}")

    if not source_path.exists():
        sys.exit(f"Source not found: {SOURCE}\nSave the wordmark there first, then re-run.")

    img = Image.open(source_path)
    w, h = img.size
    print(f"source: {source_path.name}  {w}x{h}")

    if args.dewhite:
        # Near-white -> transparent. Thresholded rather than exact-matching so
        # JPEG ringing and screenshot anti-aliasing around the artwork go too.
        rgba = img.convert("RGBA")
        px = rgba.load()
        cleared = 0
        for y in range(rgba.height):
            for x in range(rgba.width):
                r, g, b, a = px[x, y]
                hi, lo = max(r, g, b), min(r, g, b)
                # Drop anything DESATURATED and light: that covers the white
                # background AND the light-grey window chrome a screenshot picks
                # up. Testing on a real crop showed a plain "is it near-white?"
                # test leaves a grey toolbar line behind — and because that line
                # spans the full width, --isolate then treats it as part of the
                # largest shape and it survives into the icon.
                if hi - lo < 30 and hi > 200:
                    px[x, y] = (r, g, b, 0)
                    cleared += 1
        img = rgba
        w, h = img.size
        print(f"  dewhite: {cleared} background pixels made transparent")

    if args.isolate:
        # Keep the largest connected blob. A crop taken by hand almost always
        # catches part of a neighbouring letter; that fragment is detached from
        # the motif, so connectivity separates them where a bounding box cannot.
        rgba = img.convert("RGBA")
        w, h = rgba.size
        alpha = rgba.getchannel("A").load()
        seen = bytearray(w * h)
        best: list[tuple[int, int]] = []
        from collections import deque
        for sy in range(h):
            for sx in range(w):
                if seen[sy * w + sx] or alpha[sx, sy] < 40:
                    continue
                blob: list[tuple[int, int]] = []
                q = deque([(sx, sy)])
                seen[sy * w + sx] = 1
                while q:
                    x, y = q.popleft()
                    blob.append((x, y))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and alpha[nx, ny] >= 40:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
                if len(blob) > len(best):
                    best = blob
        if best:
            keep = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            src_px = rgba.load()
            dst_px = keep.load()
            for x, y in best:
                dst_px[x, y] = src_px[x, y]
            print(f"  isolated largest shape: {len(best)} px kept of {sum(1 for v in seen if v)}")
            img = keep

    if args.trim:
        box = img.convert("RGBA").getchannel("A").getbbox()
        if box:
            img = img.convert("RGBA").crop(box)
            print(f"  trimmed to ink: {img.width}x{img.height}")
            # Re-pad to a square so the icon is not stretched by the resize.
            side = max(img.size)
            padded = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            padded.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
            img = padded
            w, h = img.size
            print(f"  padded to square: {side}x{side}")

    # An already-square source IS the mark — cropping it again would eat into
    # the artwork. This is the normal case now that public/logo.png holds the
    # motif rather than the full wordmark; the crop path below only matters when
    # re-deriving the icons from the wide original.
    if not args.center and 0.8 <= w / h <= 1.25:
        print("  source is already square — using it as-is, no crop")
        square = img.convert("RGBA")
        if args.preview:
            square.save(PREVIEW)
            print(f"  wrote {PREVIEW.relative_to(ROOT)} ({w}x{h})")
            return
        ICON.parent.mkdir(parents=True, exist_ok=True)
        square.resize((512, 512), Image.LANCZOS).save(ICON)
        square.resize((180, 180), Image.LANCZOS).save(APPLE_ICON)
        print(f"  wrote {ICON.relative_to(ROOT)} (512x512)")
        print(f"  wrote {APPLE_ICON.relative_to(ROOT)} (180x180)")
        print("")
        print("Now delete src/app/favicon.ico so the old default stops winning.")
        return

    extents = column_extents(ink_mask(img))

    if args.center is not None:
        cx = int(w * args.center)
        x0, x1 = cx - h // 2, cx + h // 2
        print(f"  motif centre forced to x={cx} ({args.center:.0%} of width)")
    else:
        x0, x1 = find_motif(extents)
        cx = (x0 + x1) // 2
        print(f"  motif detected at x={x0}..{x1} (centre {cx}, {cx / w:.0%} of width)")

    # The square is sized from the MOTIF's own bounding box, not the artwork
    # height. Using the full height makes the square wider than the motif, and
    # that extra width drags in fragments of the neighbouring letters — the crop
    # then reads as "…A ✻ M…" instead of a clean mark.
    band = [e for e in extents[max(x0, 0):x1 + 1] if e]
    top_y = min(e[0] for e in band) if band else 0
    bot_y = max(e[1] for e in band) if band else h
    cy = (top_y + bot_y) // 2
    side = int(max(x1 - x0, bot_y - top_y) * (1 + args.pad))
    left = cx - side // 2
    top = cy - side // 2
    print(f"  motif box: {x1 - x0}x{bot_y - top_y} -> {side}x{side} square")

    # Transparent canvas, so the crop works on a mark with no background.
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img.convert("RGBA"), (-left, -top))

    if args.preview:
        canvas.save(PREVIEW)
        print(f"  wrote {PREVIEW.relative_to(ROOT)} ({side}x{side}) — check it, then re-run without --preview")
        return

    ICON.parent.mkdir(parents=True, exist_ok=True)
    canvas.resize((512, 512), Image.LANCZOS).save(ICON)
    canvas.resize((180, 180), Image.LANCZOS).save(APPLE_ICON)
    print(f"  wrote {ICON.relative_to(ROOT)} (512x512)")
    print(f"  wrote {APPLE_ICON.relative_to(ROOT)} (180x180)")
    print("\nNow delete src/app/favicon.ico so the old default stops winning.")


if __name__ == "__main__":
    main()

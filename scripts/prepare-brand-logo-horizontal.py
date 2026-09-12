#!/usr/bin/env python3
"""
Build `assets/brand-logo-horizontal.png` — the one-line wordmark the light
screens use — from the original horizontal artwork.

Why this script exists: every horizontal version of the logo we have was drawn
for a dark background. `design/assets/brand-legacy/brand-logo-horizontal-original.png`,
`public/newsletter-logo.png` and the `logo.png` in the `company-logos` bucket
all render "COUPON" in white, which is invisible on the app's cream background.
The only light-background artwork is the stacked square, and at 1:1 it cost a
quarter of the login screen.

So the light version is derived rather than redrawn: the original's shapes and
spacing are untouched, and only the fill colours are swapped for the two the
stacked light logo already uses. Nothing here is a new design.

What it does:
- Finds the solid shapes (flood fill over the alpha channel). Six white letters
  spell COUPON, six blue ones spell MASTER, and one white shape between them is
  the ticket.
- Paints the letters navy and the ticket the brand blue, exactly as
  `brand-logo-stacked.png` draws them, keeping every pixel's own alpha so the
  drawn edges stay as the designer made them.
- Drops the soft white glow, which only made sense over a dark background and
  which reads as grey haze over a light one. Alpha is kept within RIM pixels of
  a solid shape — the anti-aliased rim — and discarded beyond it.
- Crops to the ink.

Requires Pillow. Run after changing the source artwork:
    python3 scripts/prepare-brand-logo-horizontal.py
"""
import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "design", "assets", "brand-legacy", "brand-logo-horizontal-original.png")
OUT = os.path.join(ROOT, "assets", "brand-logo-horizontal.png")

# The two colours `brand-logo-stacked.png` uses on a light background.
NAVY = (21, 32, 46)
PRIMARY = (31, 111, 209)  # palette.primary
# Above this alpha a pixel belongs to a shape rather than to the glow.
SOLID_ALPHA = 140
# Anti-aliasing to keep around each shape, in pixels.
RIM = 2
# Smaller than this is glow residue, not artwork.
MIN_AREA = 200


def shapes(px, w, h):
    solid = [[px[x, y][3] > SOLID_ALPHA for x in range(w)] for y in range(h)]
    seen = [[False] * w for _ in range(h)]
    found = []
    for y0 in range(h):
        for x0 in range(w):
            if not solid[y0][x0] or seen[y0][x0]:
                continue
            queue, pixels = deque([(x0, y0)]), []
            seen[y0][x0] = True
            while queue:
                x, y = queue.popleft()
                pixels.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and solid[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        queue.append((nx, ny))
            if len(pixels) < MIN_AREA:
                continue
            blue = sum(1 for x, y in pixels if px[x, y][2] > px[x, y][0] + 30)
            found.append({"pixels": pixels, "blue": blue / len(pixels) > 0.5})
    return found


def main():
    source = Image.open(SRC).convert("RGBA")
    w, h = source.size
    px = source.load()

    found = shapes(px, w, h)
    whites = [shape for shape in found if not shape["blue"]]
    if not whites:
        raise SystemExit("no white shapes found — has the source artwork changed?")
    # The ticket is the white shape that sits between the two words, so it is
    # the rightmost of them.
    ticket = max(whites, key=lambda shape: max(x for x, _ in shape["pixels"]))
    for shape in found:
        shape["colour"] = PRIMARY if (shape["blue"] or shape is ticket) else NAVY

    colour_at = {}
    for shape in found:
        for x, y in shape["pixels"]:
            for dy in range(-RIM, RIM + 1):
                for dx in range(-RIM, RIM + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        colour_at.setdefault((nx, ny), shape["colour"])

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    target = out.load()
    for y in range(h):
        for x in range(w):
            alpha = px[x, y][3]
            colour = colour_at.get((x, y))
            if alpha and colour:
                target[x, y] = (*colour, alpha)

    out = out.crop(out.getbbox())
    out.save(OUT, optimize=True)
    print(f"{OUT}: {out.size[0]}x{out.size[1]} ({os.path.getsize(OUT) // 1024}KB)")
    print("Set `brandMark`'s aspectRatio in LoginScreen to match if the size changed.")


if __name__ == "__main__":
    main()

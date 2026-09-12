#!/usr/bin/env python3
"""
Build `assets/brand-logo-inline.png` — the current 3D wordmark on one line —
out of `assets/brand-logo-premium.png`.

Why derive rather than draw: the stacked mark is square, so on the login screen
190pt of width cost 190pt of height and pushed the password field below the
fold. The horizontal artwork that exists in the repo is the pre-redesign flat
logo and does not match the app's 3D mark.

So nothing here is redesigned or recoloured. The stacked mark happens to
separate cleanly into three horizontal bands with no vertical overlap —

    COUPON   y 182..503
    ticket   y 511..782
    MASTER   y 787..1103

— so its own pixels are cropped and laid out left to right instead. The 3D
extrusion, the highlights and the soft shadows come along untouched.

Two details worth keeping if the boxes are ever re-measured:
- The words are aligned on their bottoms. Their boxes include the extrusion, so
  that is the edge the eye reads as the baseline.
- The source is opaque, matted onto its own cream (251,250,246), which is what
  makes the soft shadows work. The output keeps that cream, so it sits on the
  app's background exactly as the stacked mark already does. It is not a
  transparent asset.

Requires Pillow. Run after changing the source artwork:
    python3 scripts/prepare-brand-logo-inline.py
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand-logo-premium.png")
OUT = os.path.join(ROOT, "assets", "brand-logo-inline.png")

# Measured on the source by connected components over everything that is not
# the cream background.
COUPON = (110, 182, 1150, 504)
TICKET = (501, 511, 767, 783)
MASTER = (96, 787, 1166, 1104)
BG = (251, 250, 246)

# Gap either side of the ticket, as a fraction of the word height. Letters
# inside a word sit ~4% apart, so this has to be clearly wider to read as a
# separator rather than a letter.
GAP_RATIO = 0.15
# The ticket is shorter than the caps in the stacked lockup, where it sits in
# its own band. On one line the eye compares it to the letters beside it, so it
# is brought up to about cap height.
TICKET_SCALE = 1.15
# Rendered at most 300pt wide at 3x, so anything past this is only file size.
MAX_WIDTH = 1200


def main():
    src = Image.open(SRC).convert("RGB")
    coupon, ticket, master = (src.crop(box) for box in (COUPON, TICKET, MASTER))

    words_height = max(coupon.height, master.height)
    gap = int(words_height * GAP_RATIO)
    ticket = ticket.resize(
        (round(ticket.width * TICKET_SCALE), round(ticket.height * TICKET_SCALE)),
        Image.LANCZOS,
    )

    width = coupon.width + gap + ticket.width + gap + master.width
    canvas = Image.new("RGB", (width, words_height), BG)
    canvas.paste(coupon, (0, words_height - coupon.height))
    x = coupon.width + gap
    canvas.paste(ticket, (x, (words_height - ticket.height) // 2))
    canvas.paste(master, (x + ticket.width + gap, words_height - master.height))

    if canvas.width > MAX_WIDTH:
        scale = MAX_WIDTH / canvas.width
        canvas = canvas.resize((MAX_WIDTH, round(canvas.height * scale)), Image.LANCZOS)

    canvas.save(OUT, optimize=True)
    print(f"{OUT}: {canvas.width}x{canvas.height} ({os.path.getsize(OUT) // 1024}KB)")
    print(f"aspectRatio for LoginScreen's brandMark: {canvas.width} / {canvas.height}")


if __name__ == "__main__":
    main()

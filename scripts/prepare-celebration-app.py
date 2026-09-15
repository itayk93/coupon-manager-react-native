#!/usr/bin/env python3
"""Downscale the celebration scenes for in-app use.

The source PNGs in `assets/mascot/celebration/` are 1254x1254 production art,
19MB in total — fine as widget resources compiled per platform, far too much to
bundle into the JS app. The app shows a scene at 132pt in a banner, so 512px
covers a 3x screen with room to spare.

Run after adding or replacing a scene:

    pip install Pillow
    python3 scripts/prepare-celebration-app.py

Requires Pillow. Writes `assets/mascot/celebration/app/*.webp`.
"""
from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

SIZE = 512
QUALITY = 82
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "mascot" / "celebration"
OUT = SRC / "app"

# C5 (usage streak) is deliberately not shipped: it measures app opens rather
# than money. See docs/mascot/INVENTORY.md section 4. C10 is not shipped either
# — SixSevenCelebration animates that moment, and a still frame is worse.
SKIP = {"C5-usage-streak", "C4-monthly-recap-alt", "C10-six-seven"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(SRC.glob("*.png")):
        if path.stem in SKIP:
            print(f"skip  {path.name}")
            continue
        image = Image.open(path).convert("RGB")
        image = image.resize((SIZE, SIZE), Image.LANCZOS)
        target = OUT / f"{path.stem}.webp"
        image.save(target, "WEBP", quality=QUALITY, method=6)
        size = target.stat().st_size
        total += size
        print(f"write {target.name}  {size // 1024}K")
    print(f"total {total // 1024}K")


if __name__ == "__main__":
    main()

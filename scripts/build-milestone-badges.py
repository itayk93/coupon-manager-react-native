"""Size the milestone badges the image tool produced. Requires Pillow.
Run from any directory: python3 scripts/build-milestone-badges.py

Artwork edits belong in `assets/mascot/milestones/source/`; this script only
normalizes the footprint. An image tool frames each badge differently — the
first came back 1254px wide with the object sitting high and nearly edge to
edge — so a trail of them drawn at one size would have each badge at its own
apparent scale. Trimming to the artwork and re-centring in a square with the
same margin is what makes twelve separate generations read as one set.

See `assets/mascot/MILESTONE_BADGES_BRIEF.md` for the prompts and the names.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/mascot/milestones/source"
OUT = ROOT / "assets/mascot/milestones"
SIZE = 512  # 170pt at the densest ratio any device asks for, with room over.
MARGIN = 0.06  # Of the canvas, on the longest side — the same on all four.

OUT.mkdir(parents=True, exist_ok=True)
built = []
for path in sorted(SOURCE.glob("*.png")):
    art = Image.open(path).convert("RGBA")
    bounds = art.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"{path.name} is empty — a badge must carry its own alpha")
    art = art.crop(bounds)
    inner = round(SIZE * (1 - MARGIN * 2))
    scale = inner / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    target = OUT / f"{path.stem}.webp"
    canvas.save(target, "WEBP", quality=92, method=6)
    built.append((target.name, target.stat().st_size))

for name, size in built:
    print(f"build-milestone-badges: {name} ({size / 1024:.0f} KB)")
print(f"build-milestone-badges: {len(built)} of 12")

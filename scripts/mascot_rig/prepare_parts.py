"""Import a generated layer kit into `assets/mascot/3d/rig/`, cleaned.

    python3 scripts/mascot_rig/prepare_parts.py path/to/kuponi-state-layers

The generator's output is used as drawn. Two things are corrected, and neither
touches geometry: no pixel moves, and nothing is scaled or warped here.

- Specks. Stray alpha islands away from the part (the generator leaves a few)
  are dropped. Only components under 0.5% of the part's largest one go.
- Lens opacity. The magnifier lenses came back 73-98% opaque, which hides the
  face behind them. Pixels inside the rim are remapped into 55-75% by rank,
  so the lens keeps its own shading; the white glint stays at most 85%.

The full-character `state-reference` drafts are not imported: the generator
redrew the body in them, so they are pose illustrations, not placement targets.
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "assets/mascot/3d/rig"
LENSES = {"magnifier-raised.png", "magnifier-lowered.png", "magnifier-front-tilted.png"}
LENS_ALPHA = (0.55, 0.75)
GLINT_ALPHA = 0.85


def drop_specks(rgba: np.ndarray) -> tuple[np.ndarray, int]:
    solid = (rgba[..., 3] > 8).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if count <= 2:
        return rgba, 0
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = np.zeros(count, bool)
    keep[1:] = areas >= 0.005 * areas.max()
    # Faint alpha around a kept part belongs to it; grow the kept mask a little
    # so its own anti-aliased edge is never cut.
    kept = cv2.dilate(keep[labels].astype(np.uint8), np.ones((5, 5), np.uint8))
    out = rgba.copy()
    out[..., 3] = np.where(kept > 0, out[..., 3], 0)
    return out, int((~keep[1:]).sum())


def soften_lens(rgba: np.ndarray) -> tuple[np.ndarray, tuple[float, float]]:
    a = rgba.astype(int)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # The lens is the one large pale-blue region; the mitten is a deeper blue
    # (red channel well under 85), so colour alone separates them. Holes in
    # that region (the white glint) are filled back in.
    pale = ((b > 170) & (r > 85) & (r < 235) & (alpha > 8)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(pale, connectivity=8)
    if count < 2:
        raise ValueError("lens not found")
    lens = (labels == 1 + int(stats[1:, cv2.CC_STAT_AREA].argmax())).astype(np.uint8)
    contours, _ = cv2.findContours(lens, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(lens)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    # Pulled in 3px so the rim's own anti-aliased inner edge is left alone.
    inside = cv2.erode(filled, np.ones((7, 7), np.uint8)) > 0
    inside &= alpha > 8
    if inside.sum() < 1000:
        raise ValueError("lens not found")
    values = alpha[inside].astype(float)
    ranks = values.argsort().argsort() / max(1, len(values) - 1)
    lo, hi = LENS_ALPHA
    new = lo + ranks * (hi - lo)
    glint = (r[inside] > 225) & (g[inside] > 225) & (b[inside] > 225)
    new = np.where(glint, np.minimum(np.maximum(new, values / 255), GLINT_ALPHA), new)
    out = rgba.copy()
    out[..., 3][inside] = np.round(new * 255).astype(np.uint8)
    return out, (float(new.min()), float(new.max()))


def main(kit: Path) -> None:
    for path in sorted(kit.glob("*/*.png")):
        if "state-reference" in path.name or path.parent.name == "rejected":
            continue
        rgba = np.array(Image.open(path).convert("RGBA"))
        rgba, specks = drop_specks(rgba)
        note = f"{specks} specks dropped" if specks else ""
        if path.name in LENSES:
            rgba, span = soften_lens(rgba)
            note += f"{', ' if note else ''}lens alpha {span[0]:.2f}-{span[1]:.2f}"
        target = DEST / path.parent.name / path.name
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba).save(target, optimize=True)
        print(f"{target.relative_to(ROOT)} {note}".rstrip())
    for doc in ("PROMPTS.md", "manifest.json", "READ-ME.txt"):
        if (kit / doc).exists():
            (DEST / f"states-{doc}").write_bytes((kit / doc).read_bytes())


if __name__ == "__main__":
    main(Path(sys.argv[1]))

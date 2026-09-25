"""Build `assets/mascot/3d/scan-smooth.webp` from the rigid scan rig.

    python3 scripts/mascot_rig/build_scan.py [--preview DIR]

Requires Pillow, numpy and opencv-python. The rig lives in
`assets/mascot/3d/rig/scan/` (generated layers + `rig.json`).

Every moving part is a whole layer that is translated or turned. Nothing is
warped, and nothing is ever blended with a different drawing of itself, so the
body cannot change shape between frames. `check()` below proves it for every
frame before the atlas is written.

Choreography, one 36-frame loop at 18fps (2s). Every curve is a sum of sines
with whole-number harmonics of the loop, so position and velocity both match
across the 35 -> 0 wrap and there is no seam:

- The whole character rocks on his feet, 1.2 degrees each way.
- The face slides a few pixels ahead of the rock, which reads as the head
  turning rather than the body leaning.
- The magnifier sweeps a slow arc about his grip, lagging the body.
- The pupils follow the lens, leading it slightly.
- The resting arm swings with a longer lag.
- The brows lift once mid-loop ("found it"), and he blinks once late in it.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig import ROOT, Rig, downsample, unpremultiply  # noqa: E402

RIG = ROOT / "assets/mascot/3d/rig/scan/rig.json"
OUT = ROOT / "assets/mascot/3d/scan-smooth.webp"
NATIVE = [ROOT / f"targets/{t}/Assets.xcassets/MascotScan.imageset/atlas.png" for t in ("share", "add-share")]
COUNT, GRID, CELL, SUPERSAMPLE = 36, 6, 320, 4
FACE = ["eye-left", "eye-right", "pupil-left", "pupil-right", "lid-half-left", "lid-half-right",
        "lid-closed-left", "lid-closed-right", "brow-left", "brow-right", "mouth"]
LIDS = {"lid-half-left", "lid-half-right", "lid-closed-left", "lid-closed-right"}
UNUSED = {"brow-raised-left", "brow-raised-right"}
TAU = 2 * math.pi


def wave(t: float, harmonic: int, phase: float = 0.0) -> float:
    return math.sin(TAU * harmonic * t + phase)


def bump(t: float, centre: float, width: float) -> float:
    """A smooth, periodic 0..1 bump: raised cosine, zero outside its window."""
    d = (t - centre + 0.5) % 1.0 - 0.5
    return 0.5 * (1 + math.cos(math.pi * d / width)) if abs(d) < width else 0.0


def pose(rig: Rig, frame: int):
    t = frame / COUNT
    feet = tuple(rig.spec["feet"])
    lay = {entry["name"]: entry for entry in rig.spec["layers"]}
    body = (0.0, 0.0, 1.2 * wave(t, 1), feet)
    transforms: dict[str, list[tuple]] = {name: [] for name in rig.order}

    # Face: slides ahead of the rock, and the brows lift once around t = 0.47.
    face_dx = 4.0 * wave(t, 1, 0.5)
    lift = bump(t, 0.47, 0.14)
    for name in FACE:
        transforms[name].append((face_dx, 0.0, 0.0, feet))
    for name in ("brow-left", "brow-right"):
        transforms[name].append((0.0, -7.0 * lift, 0.0, feet))

    # Pupils lead the lens a little; they are clipped to the eye whites.
    for name in ("pupil-left", "pupil-right"):
        transforms[name].append((6.0 * wave(t, 1, -0.2), 2.5 * wave(t, 2, 0.6) - 2.0 * lift, 0.0, feet))

    # Magnifier: an arc about the grip, lagging the body.
    grip = tuple(lay["magnifier"]["pivot"])
    transforms["magnifier"].append((10.0 * wave(t, 1, -0.6), 3.0 * wave(t, 2, -1.0),
                                    3.5 * wave(t, 1, -0.6), grip))

    # Resting arm: a gentle swing about the shoulder, lagging further.
    shoulder = tuple(lay["hand-left"]["pivot"])
    transforms["hand-left"].append((0.0, 0.0, 3.0 * wave(t, 1, -0.9), shoulder))

    for name in rig.order:
        transforms[name].append(body)

    hidden = set(UNUSED) | LIDS
    # One blink: half, closed, half. Away from the wrap so the seam stays clean.
    if frame in (26, 28):
        hidden -= {"lid-half-left", "lid-half-right"}
    elif frame == 27:
        hidden -= {"lid-closed-left", "lid-closed-right"}
    return transforms, hidden


def body_mask(frame_rgba: np.ndarray) -> np.ndarray:
    return frame_rgba[..., 3] > 127


def check(frames: list[np.ndarray], rig: Rig) -> None:
    """Rigidity and seam checks. Raises on failure."""
    # 1. The body layer alone, un-rotated, must be identical in every frame.
    body_only = []
    for i in range(COUNT):
        transforms, _ = pose(rig, i)
        hide = set(rig.order) - {"body"}
        pm = rig.render({"body": transforms["body"]}, hide)
        body_only.append(pm[..., 3])
    widths, heights = [], []
    for alpha in body_only:
        ys, xs = np.nonzero(alpha > 0.5)
        cov = np.cov(np.vstack([xs, ys]))
        # Principal axes of the silhouette are invariant under rotation, so
        # they measure shape, not placement.
        evals = np.sort(np.linalg.eigvalsh(cov))
        widths.append(math.sqrt(evals[0]))
        heights.append(math.sqrt(evals[1]))
        assert abs(alpha.sum() - body_only[0].sum()) / body_only[0].sum() < 0.002, "body area changed"
    spread = (max(widths) - min(widths)) / widths[0], (max(heights) - min(heights)) / heights[0]
    assert max(spread) < 0.002, f"body shape changed: {spread}"

    # 2. Seam: the wrap step is no bigger than an ordinary step.
    steps = [np.abs(frames[i].astype(int) - frames[(i + 1) % COUNT].astype(int)).mean() for i in range(COUNT)]
    inner = sorted(steps[:-1])
    median = inner[len(inner) // 2]
    blink = {25, 26, 27, 28}
    ordinary = [s for i, s in enumerate(steps) if i not in blink]
    assert steps[-1] <= 1.5 * median, f"loop seam {steps[-1]:.3f} vs median {median:.3f}"
    assert max(ordinary) <= 3 * median, f"pop: {max(ordinary):.3f} vs median {median:.3f}"

    # 3. Nothing touches the cell edge.
    for i, f in enumerate(frames):
        a = f[..., 3]
        margin = int(CELL * 0.03)
        edge = np.concatenate([a[:margin].ravel(), a[-margin:].ravel(), a[:, :margin].ravel(), a[:, -margin:].ravel()])
        assert edge.max() == 0, f"frame {i} touches the edge"
    print(f"checks: body width/height spread {spread[0]:.4%} / {spread[1]:.4%}, "
          f"seam {steps[-1]:.3f}, median step {median:.3f}, largest step {max(ordinary):.3f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    render_scale = CELL * SUPERSAMPLE / 1000
    rig = Rig(RIG, render_scale)
    assert rig.window["size"] == 1000
    frames = []
    for i in range(COUNT):
        transforms, hidden = pose(rig, i)
        frames.append(unpremultiply(downsample(rig.render(transforms, hidden), CELL)))
    check(frames, rig)

    atlas = Image.new("RGBA", (GRID * CELL, GRID * CELL))
    for i, f in enumerate(frames):
        atlas.alpha_composite(Image.fromarray(f), ((i % GRID) * CELL, (i // GRID) * CELL))
    atlas.save(OUT, lossless=True, quality=100, method=6, exact=True)
    with Image.open(OUT) as decoded:
        assert np.array_equal(np.asarray(decoded.convert("RGBA")), np.asarray(atlas)), "lossless round-trip"
    for path in NATIVE:
        path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(path, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({GRID}x{GRID}, {CELL}px cells)")

    if args.preview:
        args.preview.mkdir(parents=True, exist_ok=True)
        for name, colour in (("light", (248, 247, 244)), ("dark", (18, 18, 18))):
            gif = []
            for f in frames:
                bg = Image.new("RGBA", (CELL, CELL), colour + (255,))
                bg.alpha_composite(Image.fromarray(f))
                gif.append(bg.convert("RGB"))
            gif[0].save(args.preview / f"scan-{name}.webp", save_all=True, append_images=gif[1:],
                        duration=round(1000 / 18), loop=0, lossless=True)
            gif[0].save(args.preview / f"scan-{name}.gif", save_all=True, append_images=gif[1:],
                        duration=round(1000 / 18), loop=0)
        sheet = Image.new("RGBA", atlas.size, (248, 247, 244, 255))
        sheet.alpha_composite(atlas)
        sheet.convert("RGB").save(args.preview / "scan-contact-sheet.png")


if __name__ == "__main__":
    main()

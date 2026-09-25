"""Build Kuponi's animation atlases from the rigid rigs.

    python3 scripts/mascot_rig/build.py                 # every state
    python3 scripts/mascot_rig/build.py scan success    # some states
    python3 scripts/mascot_rig/build.py --preview /tmp/kuponi-review

Requires Pillow, numpy and opencv-python. Layers live in `assets/mascot/3d/rig/`
(scan's placement in `rig/scan/rig.json`, the other states in `states.py`).

Every moving part is a whole layer that is translated or turned about a pivot.
Nothing is warped, stretched or morphed, and a drawing is never blended with a
different drawing of itself, so the body cannot change shape between frames.
Expression changes are instant swaps of whole parts, timed on a blink or on a
talking beat so they read as expression rather than as a pop. `check()` proves
the body is rigid, the loop seam is clean, and nothing touches the cell edge,
for every frame, before an atlas is written.

All loops are sums of sines with whole-number harmonics of the loop, so
position and velocity both match across the 35 -> 0 wrap.
"""
from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig import ROOT, Rig, downsample, unpremultiply  # noqa: E402
from states import SPECS  # noqa: E402

RIGS = ROOT / "assets/mascot/3d/rig"
OUT = ROOT / "assets/mascot/3d"
COUNT, GRID, CELL, SUPERSAMPLE = 36, 6, 320, 4
TAU = 2 * math.pi
LIDS_HALF = {"lid-half-left", "lid-half-right"}
LIDS_CLOSED = {"lid-closed-left", "lid-closed-right"}
FACE_PREFIXES = ("eye", "pupil", "lid", "brow", "mouth")


def wave(t: float, harmonic: int, phase: float = 0.0) -> float:
    return math.sin(TAU * harmonic * t + phase)


def bump(t: float, centre: float, width: float) -> float:
    """A smooth, periodic 0..1 bump: raised cosine, zero outside its window."""
    d = (t - centre + 0.5) % 1.0 - 0.5
    return 0.5 * (1 + math.cos(math.pi * d / width)) if abs(d) < width else 0.0


def glance(t: float, harmonic: int = 1, sharpness: float = 3.0) -> float:
    """-1..1, holding at each end and moving quickly between: a look, not a sway."""
    return math.tanh(sharpness * wave(t, harmonic)) / math.tanh(sharpness)


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


class Pose:
    """Per-frame transforms. Local moves first; the whole body's move last."""

    def __init__(self, rig: Rig, frame: int, visible: set[str]):
        self.rig, self.frame, self.t = rig, frame, frame / COUNT
        self.feet = tuple(rig.spec["feet"])
        self.pivot = {e["name"]: tuple(e["pivot"]) for e in rig.spec["layers"] if "pivot" in e}
        self.moves: dict[str, list[tuple]] = {name: [] for name in rig.order}
        self.visible = set(visible)

    def move(self, names, dx=0.0, dy=0.0, deg=0.0, pivot=None):
        for name in [names] if isinstance(names, str) else names:
            if name in self.moves:
                self.moves[name].append((dx, dy, deg, pivot or self.pivot.get(name, self.feet)))

    def face(self) -> list[str]:
        return [n for n in self.rig.order if n.startswith(FACE_PREFIXES)]

    def blink(self, start: int) -> None:
        if self.frame in (start, start + 2):
            self.visible |= LIDS_HALF
        elif self.frame == start + 1:
            self.visible |= LIDS_CLOSED

    def done(self, dx=0.0, dy=0.0, deg=0.0):
        for name in self.rig.order:
            self.moves[name].append((dx, dy, deg, self.feet))
        return self.moves, set(self.rig.order) - self.visible


BASE = {"body", "eye-left", "eye-right", "pupil-left", "pupil-right", "brow-left", "brow-right"}


def scan(rig, frame):
    p = Pose(rig, frame, BASE | {"mouth", "magnifier", "hand-left"})
    t = p.t
    lift = bump(t, 0.47, 0.14)
    p.move(p.face(), dx=4.0 * wave(t, 1, 0.5))
    p.move(["brow-left", "brow-right"], dy=-7.0 * lift)
    p.move(["pupil-left", "pupil-right"], dx=6.0 * wave(t, 1, -0.2), dy=2.5 * wave(t, 2, 0.6) - 2.0 * lift)
    p.move("magnifier", 10.0 * wave(t, 1, -0.6), 3.0 * wave(t, 2, -1.0), 3.5 * wave(t, 1, -0.6))
    p.move("hand-left", deg=3.0 * wave(t, 1, -0.9))
    p.blink(26)
    return p.done(deg=1.2 * wave(t, 1))


# Talking beats, three frames each; opens and closes on the smile so the
# wrap joins smile to smile.
TALK = ["mouth-smile", "mouth-a", "mouth-e", "mouth-o", "mouth-a", "mouth-smile",
        "mouth-e", "mouth-a", "mouth-o", "mouth-e", "mouth-a", "mouth-smile"]


def greeting(rig, frame):
    p = Pose(rig, frame, BASE | {"hand-wave", "magnifier", TALK[frame // 3]})
    t = p.t
    p.move(p.face(), dx=3.0 * wave(t, 1, 0.5))
    p.move(["brow-left", "brow-right"], dy=-5.0 * (1 - math.cos(TAU * 2 * t)) / 2)
    p.move(["pupil-left", "pupil-right"], dx=3.0 * wave(t, 1, 0.3))
    p.move("hand-wave", deg=16.0 * wave(t, 2))
    p.move("magnifier", deg=4.0 * wave(t, 1, -0.8))
    p.blink(20)
    return p.done(deg=2.0 * wave(t, 1))


def hop(t: float) -> float:
    """A big hop and a small one per loop, landing on frames 18 and 0."""
    if t < 0.5:
        return 42.0 * math.sin(math.pi * t / 0.5)
    return 20.0 * math.sin(math.pi * (t - 0.5) / 0.5)


def success(rig, frame):
    p = Pose(rig, frame, {"body", "eyes-happy-left", "eyes-happy-right", "brow-left", "brow-right",
                          "mouth", "hand-fist", "magnifier"})
    t = p.t
    p.move(p.face(), dy=-3.0 * wave(t, 2, -0.6))
    p.move("hand-fist", deg=-10.0 * wave(t, 2, -0.5))
    p.move("magnifier", deg=6.0 * wave(t, 2, -1.0))
    return p.done(dy=-hop(t), deg=2.0 * wave(t, 1))


def concern(rig, frame):
    p = Pose(rig, frame, BASE | {"mouth", "hand-fist", "magnifier"})
    t = p.t
    p.move(p.face(), dx=2.5 * wave(t, 1, 0.5))
    p.move(["pupil-left", "pupil-right"], dx=7.0 * glance(t))
    p.move("hand-fist", dx=7.0 * (bump(t, 0.22, 0.07) + bump(t, 0.72, 0.07)))
    p.move("magnifier", deg=5.0 * wave(t, 1, -0.8))
    p.blink(20)
    return p.done(deg=1.5 * wave(t, 1))


def worried(rig, frame):
    p = Pose(rig, frame, BASE | {"mouth", "hand-fist", "magnifier"})
    t = p.t
    p.move(p.face(), dx=3.0 * wave(t, 1, 0.5))
    p.move(["pupil-left", "pupil-right"], dx=6.0 * glance(t, 2, 2.5))
    taps = sum(bump(t, c, 0.06) for c in (0.15, 0.48, 0.81))
    p.move("hand-fist", dx=6.0 * taps)
    p.move("magnifier", 6.0 * wave(t, 1, -0.6), 0.0, 3.0 * wave(t, 1, -0.6))
    p.blink(26)
    return p.done(dx=2.5 * wave(t, 4), deg=2.0 * wave(t, 1))


def tremble(t: float) -> tuple[float, float]:
    return 4.0 * wave(t, 6) + 2.0 * wave(t, 9, 1.0), 1.0 * wave(t, 6)


def alarmed(rig, frame):
    p = Pose(rig, frame, BASE | {"mouth", "hand-up", "magnifier"})
    t = p.t
    p.move(["pupil-left", "pupil-right"], dx=1.5 * wave(t, 6, -0.4))
    p.move("hand-up", deg=4.0 * wave(t, 6, -0.5))
    p.move("magnifier", deg=3.0 * wave(t, 6, -0.7))
    dx, deg = tremble(t)
    return p.done(dx=dx, deg=deg)


def relieved(rig, frame):
    """One-shot: starts on alarmed frame 0, ends calm and holds frame 35."""
    calm = frame >= 11  # the expression swaps while his eyes are shut (10-12)
    visible = {"body", "eye-left", "eye-right", "hand-up", "magnifier"}
    if calm:
        visible |= {"brow-left", "brow-right", "pupil-left-calm", "pupil-right-calm",
                    "mouth-exhale" if frame < 24 else "mouth-smile"}
    else:
        visible |= {"brow-left-alarmed", "brow-right-alarmed", "pupil-left", "pupil-right", "mouth-alarmed"}
    p = Pose(rig, frame, visible)
    if frame in (9, 13):
        p.visible |= LIDS_HALF
    elif frame in (10, 11, 12):
        p.visible |= LIDS_CLOSED
    # The tremble dies away over the first eight frames.
    fade = max(0.0, 1 - frame / 8)
    dx, deg = tremble(frame / COUNT)
    # Hand and magnifier come down together, easing in and out, with a small
    # settle past the rest pose at the end.
    down = ease((frame - 12) / 16) + 0.04 * math.sin(math.pi * ease((frame - 26) / 9))
    p.move("hand-up", dx=-22.0 * down, dy=70.0 * down, deg=-24.0 * down)
    p.move("magnifier", dx=-6.0 * down, dy=55.0 * down, deg=22.0 * down)
    # The exhale: a slow lean forward and back.
    lean = 2.0 * math.sin(math.pi * ease((frame - 10) / 20))
    return p.done(dx=dx * fade, deg=deg * fade + lean)


def six_seven(rig, frame):
    p = Pose(rig, frame, BASE | LIDS_HALF | {"mouth", "palm-left", "palm-right"})
    t = p.t
    s = wave(t, 1)
    p.move("palm-left", dy=-55.0 * s, deg=12.0 * s)
    p.move("palm-right", dx=8.0 * math.cos(TAU * t), dy=55.0 * s, deg=12.0 * s)
    p.move(["pupil-left", "pupil-right"], dx=4.0 * wave(t, 1, 0.8))
    p.move(p.face(), dx=3.0 * wave(t, 1, math.pi / 2))
    return p.done(deg=2.0 * wave(t, 1, math.pi / 2))


@dataclass
class State:
    pose: Callable
    fps: int
    loop: bool = True
    native: str | None = None


STATES = {
    "scan": State(scan, 18, native="MascotScan"),
    "greeting": State(greeting, 24),
    "success": State(success, 24, native="MascotSuccess"),
    "concern": State(concern, 16),
    "worried": State(worried, 18),
    "alarmed": State(alarmed, 24),
    "relieved": State(relieved, 24, loop=False),
    "six-seven": State(six_seven, 24),
}


def load_rig(name: str, render_scale_for) -> Rig:
    if name == "scan":
        path = RIGS / "scan/rig.json"
        import json
        size = json.loads(path.read_text())["window"]["size"]
        return Rig(path, render_scale_for(size))
    spec = SPECS[name]
    return Rig(spec, render_scale_for(spec["window"]["size"]), RIGS)


def check(name: str, state: State, rig: Rig, frames: list[np.ndarray]) -> str:
    """Rigidity, seam and margin checks. Raises on failure."""
    # 1. The body layer alone must keep its area and its principal axes in
    #    every frame (those are invariant under rotation and translation).
    area0 = axes0 = None
    worst = 0.0
    for i in range(COUNT):
        moves, _ = state.pose(rig, i)
        alpha = rig.render({"body": moves["body"]}, set(rig.order) - {"body"})[..., 3]
        ys, xs = np.nonzero(alpha > 0.5)
        axes = np.sqrt(np.sort(np.linalg.eigvalsh(np.cov(np.vstack([xs, ys])))))
        area = alpha.sum()
        if area0 is None:
            area0, axes0 = area, axes
        worst = max(worst, abs(area - area0) / area0, *(abs(axes - axes0) / axes0))
    assert worst < 0.002, f"{name}: body shape changed by {worst:.3%}"

    # 2. No pops, and for loops a seam no bigger than an ordinary step.
    steps = [np.abs(frames[i].astype(int) - frames[(i + 1) % COUNT].astype(int)).mean() for i in range(COUNT)]
    inner = sorted(steps[:-1])
    median = inner[len(inner) // 2]
    seam = f", seam {steps[-1]:.2f}" if state.loop else ""
    if state.loop:
        assert steps[-1] <= 1.05 * max(steps[:-1]), f"{name}: loop seam {steps[-1]:.2f}"

    # 3. Nothing touches the cell edge.
    margin = int(CELL * 0.03)
    for i, f in enumerate(frames):
        a = f[..., 3]
        edge = np.concatenate([a[:margin].ravel(), a[-margin:].ravel(), a[:, :margin].ravel(), a[:, -margin:].ravel()])
        assert edge.max() == 0, f"{name}: frame {i} touches the edge"
    return f"body drift {worst:.4%}, median step {median:.2f}, largest {max(steps[:-1]):.2f}{seam}"


def build(name: str, preview: Path | None) -> None:
    state = STATES[name]
    rig = load_rig(name, lambda size: CELL * SUPERSAMPLE / size)
    frames = []
    for i in range(COUNT):
        moves, hidden = state.pose(rig, i)
        frames.append(unpremultiply(downsample(rig.render(moves, hidden), CELL)))
    report = check(name, state, rig, frames)

    atlas = Image.new("RGBA", (GRID * CELL, GRID * CELL))
    for i, f in enumerate(frames):
        atlas.alpha_composite(Image.fromarray(f), ((i % GRID) * CELL, (i // GRID) * CELL))
    out = OUT / f"{name}-smooth.webp"
    atlas.save(out, lossless=True, quality=100, method=6, exact=True)
    with Image.open(out) as decoded:
        assert np.array_equal(np.asarray(decoded.convert("RGBA")), np.asarray(atlas)), "lossless round-trip"
    if state.native:
        for target in ("share", "add-share"):
            path = ROOT / f"targets/{target}/Assets.xcassets/{state.native}.imageset/atlas.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            atlas.save(path, optimize=True)
    print(f"{name}: {report}", flush=True)

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        for theme, colour in (("light", (248, 247, 244)), ("dark", (18, 18, 18))):
            shots = []
            for f in frames:
                bg = Image.new("RGBA", (CELL, CELL), colour + (255,))
                bg.alpha_composite(Image.fromarray(f))
                shots.append(bg.convert("RGB"))
            if not state.loop:
                shots += [shots[-1]] * 24  # hold the ending, as the app does
            shots[0].save(preview / f"{name}-{theme}.gif", save_all=True, append_images=shots[1:],
                          duration=round(1000 / state.fps), loop=0)
        sheet = Image.new("RGBA", atlas.size, (248, 247, 244, 255))
        sheet.alpha_composite(atlas)
        sheet.convert("RGB").save(preview / f"{name}-contact-sheet.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("states", nargs="*", metavar="state", help=", ".join(STATES))
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    unknown = set(args.states) - set(STATES)
    if unknown:
        parser.error(f"unknown state: {', '.join(sorted(unknown))}")
    for name in args.states or STATES:
        build(name, args.preview)


if __name__ == "__main__":
    main()

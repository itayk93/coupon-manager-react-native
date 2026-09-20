"""Motion-compensated in-betweens from the approved AI keyframes.

Requires Pillow, numpy and opencv-python. Preserves premultiplied alpha while
warping both endpoints with bidirectional optical flow; never redraws the mascot.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from mascot_keys import MAX_SILHOUETTE_RATIO, load_sheet, sheet_ratio
from mascot_motion import breathe, preview, validate_budget

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/3d'
CELL = 256
COUNT = 36
GRID = 6
NAMES = ['scan', 'greeting', 'success', 'concern']
#: How many poses a replacement sheet carries, and the cycle each one enables.
#: Asserted rather than discovered, so a sheet that silently loses a pose to a
#: keying failure stops the build instead of quietly shortening a cycle.
SHEETS = {
    'scan': (4, [0, 1, 2, 3, 0], [8, 7, 6, 15]),
    'greeting': (3, [0, 1, 2, 0], [12, 10, 14]),
    'success': (4, [0, 1, 2, 3, 0], [7, 8, 8, 13]),
    'concern': (4, [0, 1, 2, 3, 0], [7, 7, 8, 14]),
}
#: What each state falls back to while its replacement sheet is missing or
#: fails the framing gate: the four approved 320px rows, and the cycles their
#: pose counts allow. `success` is the reason any of this exists — two poses
#: cannot cycle, so it bounces, and only new artwork fixes it.
LEGACY = {
    'scan': ([0, 1, 2, 3, 0], [8, 7, 6, 15]),
    'greeting': ([1, 2, 3, 1], [13, 11, 12]),
    'success': ([0, 1, 0], [12, 24]),
    'concern': ([0, 1, 2, 0], [9, 11, 16]),
}
source = Image.open(OUT / 'mascot-atlas.png').convert('RGBA')
yy, xx = np.mgrid[:CELL, :CELL].astype(np.float32)


def pixels(image):
    data = np.asarray(image).astype(np.float32) / 255
    data[:, :, :3] *= data[:, :, 3:4]
    return data


def gray(data):
    composite = data[:, :, :3] + (1 - data[:, :, 3:4]) * 0.5
    return cv2.cvtColor(np.uint8(np.clip(composite * 255, 0, 255)), cv2.COLOR_RGB2GRAY)


def warp(data, flow, amount):
    # Invert the source-coordinate flow to find each intermediate pixel's origin.
    mx, my = xx.copy(), yy.copy()
    for _ in range(5):
        sampled = cv2.remap(flow, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        mx, my = xx - amount * sampled[:, :, 0], yy - amount * sampled[:, :, 1]
    return cv2.remap(data, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def image(data):
    alpha = data[:, :, 3:4]
    rgb = np.divide(data[:, :, :3], alpha, out=np.zeros_like(data[:, :, :3]), where=alpha > 0.001)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, alpha], axis=2) * 255, 0, 255)))


all_frames = []
for row, name in enumerate(NAMES):
    # Replacement sheets land one state at a time, so each state picks its own
    # source: the new artwork once it can actually be framed, the approved
    # 320px row until then. Mixing the two is free — the player sizes every
    # atlas in points from `GRID` and never reads a file's pixel dimensions.
    sheet = OUT / f'source/{name}-keyframes.png'
    ratio = sheet_ratio(sheet) if sheet.exists() else float('inf')
    if ratio <= MAX_SILHOUETTE_RATIO:
        poses, sequence, budgets = SHEETS[name]
        keys, framing = load_sheet(sheet, CELL, poses)
        print(f'{name}: {poses} new poses, silhouette {ratio:.2f}x torso, '
              f'torso {framing["torso"]:.0f}px', flush=True)
    else:
        keys = [source.crop((col*320, row*320, (col+1)*320, (row+1)*320))
                .resize((CELL, CELL), Image.Resampling.LANCZOS) for col in range(4)]
        sequence, budgets = LEGACY[name]
        if ratio != float('inf'):
            why = f'silhouette {ratio:.2f}x torso'
        elif not sheet.exists():
            why = 'no sheet yet'
        else:
            # The file is there and unreadable, which is worth saying out loud:
            # it looks like a landed sheet in `git log` and behaves like a
            # missing one here.
            why = f'sheet will not decode ({sheet.stat().st_size} bytes)'
        print(f'{name}: approved 320px keys ({why})', flush=True)
    # Topology changes (closed -> open eyes or mouth) cannot be reliably inferred
    # from only two pictures, so every sequence holds one expression throughout.
    validate_budget(sequence, budgets, COUNT)
    frames = []
    for start, end, steps in zip(sequence, sequence[1:], budgets):
        a, b = pixels(keys[start]), pixels(keys[end])
        ga, gb = gray(a), gray(b)
        estimator = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        forward = estimator.calc(ga, gb, None)
        backward = estimator.calc(gb, ga, None)
        # Untextured limbs produce discontinuous flow. Regularize the field
        # before inverse sampling; otherwise it tears small holes in a hand.
        forward = cv2.GaussianBlur(forward, (0, 0), CELL * .025)
        backward = cv2.GaussianBlur(backward, (0, 0), CELL * .025)
        for step in range(steps):
            u = step / steps
            t = u * u * (3 - 2 * u)
            # Dissolving endpoints showed two translucent arms. Sample only
            # the nearer keyframe, as the escalation renderer already does.
            frames.append(keys[start].copy() if step == 0 else image(
                warp(a, forward, t) if t < .5 else warp(b, backward, 1-t)))
    frames = breathe(frames, {"scan": .015, "greeting": .01, "concern": .015}.get(name, 0))
    assert len(frames) == COUNT
    atlas = Image.new('RGBA', (GRID*CELL, GRID*CELL))
    for index, frame in enumerate(frames):
        assert frame.getbbox() is not None
        atlas.alpha_composite(frame, ((index % GRID)*CELL, (index // GRID)*CELL))
    # Lossless WebP: pixel-identical to PNG, ~40% smaller in the bundle.
    atlas.save(OUT / f'{name}-smooth.webp', lossless=True, quality=100, method=6, exact=True)
    with Image.open(OUT / f'{name}-smooth.webp') as decoded:
        if not np.array_equal(np.asarray(decoded.convert('RGBA')), np.asarray(atlas)):
            raise ValueError(f'{name}: lossless RGBA round-trip failed')
    all_frames.append(frames)
    if name in ('scan', 'success'):
        for target in ('share', 'add-share'):
            folder = ROOT / f'targets/{target}/Assets.xcassets/Mascot{name.title()}.imageset'
            folder.mkdir(parents=True, exist_ok=True)
            atlas.save(folder / 'atlas.png', optimize=True)
    print(f'{name}: {COUNT} frames, {GRID}x{GRID} atlas', flush=True)

preview(all_frames, [12, 24, 24, 16], OUT / 'preview-smooth.webp')
# Review selected intermediate frames separately from playback.
proof = Image.new('RGB', (CELL*4, CELL*4), '#14213A')
for row in range(4):
    for col, index in enumerate([2, 8, 14, 20]):
        frame = all_frames[row][index]
        proof.paste(frame, (col*CELL, row*CELL), frame)
proof.save(OUT / 'intermediate-proof.png')

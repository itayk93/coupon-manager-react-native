"""Motion-compensated in-betweens from the approved AI keyframes.

Requires Pillow, numpy and opencv-python. Preserves premultiplied alpha while
warping both endpoints with bidirectional optical flow; never redraws the mascot.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from mascot_motion import breathe, preview, validate_budget

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/3d'
CELL = 256
COUNT = 36
GRID = 6
NAMES = ['scan', 'greeting', 'success', 'concern']
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
    keys = [source.crop((col*320, row*320, (col+1)*320, (row+1)*320)).resize((CELL, CELL), Image.Resampling.LANCZOS) for col in range(4)]
    # Topology changes (closed -> open eyes or mouth) cannot be reliably inferred
    # from only two pictures. Use consistent expressions instead of ghost faces.
    sequence = {
        'scan': [0, 1, 2, 3, 0],
        'greeting': [1, 2, 3, 1],
        'success': [0, 1, 0],
        'concern': [0, 1, 2, 0],
    }[name]
    # The fourth concern key changes grip and expression; its return cannot
    # be inferred without inventing an occluded hand. Use the three stable keys.
    # Success temporarily has only two compatible poses; its 12/24 timing is
    # deliberately asymmetric until the separate artwork upgrade supplies four.
    budgets = {'scan': [8, 7, 6, 15], 'greeting': [13, 11, 12],
               'success': [12, 24], 'concern': [9, 11, 16]}[name]
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

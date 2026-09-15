#!/usr/bin/env python3
"""Key and interpolate the expiry loops and forward-only relief sequence.

Requires Pillow, numpy and opencv-python. Production (both sheets required):
    python3 scripts/prepare-expiry-escalation.py

Pipeline smoke test while the real artwork is pending:
    python3 scripts/prepare-expiry-escalation.py \
        --escalation-source assets/mascot/3d/source/six-seven-keyframes.png \
        --relief-source assets/mascot/3d/source/six-seven-keyframes.png \
        --output-dir /tmp/kuponi-escalation-review

Override inputs require an output directory outside assets so substitute poses
cannot silently replace production artwork. Never commit smoke-test outputs.
The stand-in validates the pipeline, not the missing expressions or their motion.
Optical flow cannot resolve occlusion or changing eye/mouth topology reliably;
review intermediate frames on both backgrounds before shipping real artwork.
"""
import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/3d'
CELL = 256
COUNT = 36
GRID = 6
FPS = 24
YY, XX = np.mgrid[:CELL, :CELL].astype(np.float32)
DURATIONS = [round((i + 1) * 1000 / FPS) - round(i * 1000 / FPS)
             for i in range(COUNT)]


def load_keys(path):
    with Image.open(path) as source:
        if source.size != (1536, 1024):
            raise ValueError(f'{path}: expected 1536x1024, got {source.size}')
        rgb = np.asarray(source.convert('RGB')).astype(np.float32)
    # Use the six-seven keyer's spill suppression and conservative alpha erosion:
    # green at the silhouette must not become a halo on the app's dark theme.
    excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    alpha = 1 - np.clip(excess / 80, 0, 1)
    rgb[:, :, 1] = np.minimum(rgb[:, :, 1], np.maximum(rgb[:, :, 0], rgb[:, :, 2]))
    cutout = Image.fromarray(np.uint8(np.dstack((rgb, alpha * 255))))
    cutout.putalpha(cutout.getchannel('A').filter(ImageFilter.MinFilter(3)))
    # A fixed cell anchor preserves the camera; recentering each silhouette
    # would move the whole body whenever a hand or magnifier rises.
    keys = [cutout.crop(((i % 3) * 512, (i // 3) * 512,
                         (i % 3 + 1) * 512, (i // 3 + 1) * 512))
            .resize((CELL, CELL), Image.Resampling.LANCZOS) for i in range(6)]
    for i, key in enumerate(keys):
        low, high = key.getchannel('A').getextrema()
        if low != 0 or high != 255:
            raise ValueError(f'{path}: cell {i + 1} needs transparent background and opaque art')
    return keys


def pixels(frame):
    data = np.asarray(frame).astype(np.float32) / 255
    data[:, :, :3] *= data[:, :, 3:4]
    return data


def gray(data):
    composite = data[:, :, :3] + (1 - data[:, :, 3:4]) * 0.5
    return cv2.cvtColor(np.uint8(np.clip(composite * 255, 0, 255)), cv2.COLOR_RGB2GRAY)


def warp(data, flow, amount):
    # Match interpolate-mascot-3d.py: invert source-coordinate flow before
    # sampling premultiplied RGBA, so transparent RGB cannot bleed into edges.
    mx, my = XX.copy(), YY.copy()
    for _ in range(5):
        sampled = cv2.remap(flow, mx, my, cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_REPLICATE)
        mx, my = XX - amount * sampled[:, :, 0], YY - amount * sampled[:, :, 1]
    return cv2.remap(data, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def image(data):
    alpha = data[:, :, 3:4]
    rgb = np.divide(data[:, :, :3], alpha, out=np.zeros_like(data[:, :, :3]),
                    where=alpha > 0.001)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, alpha], axis=2) * 255, 0, 255)))


def interpolate(keys, loop):
    sequence = [0, 1, 2, 1, 0] if loop else list(range(6))
    # Loops omit the duplicate closing pose; the player supplies it on wrap.
    # Relief includes its endpoint so a one-shot can hold the actual smile.
    intervals = COUNT if loop else COUNT - 1
    segments = len(sequence) - 1
    if intervals % segments:
        raise ValueError('Frame count must evenly divide the pose intervals')
    steps = intervals // segments
    frames = []
    for start, end in zip(sequence, sequence[1:]):
        a, b = pixels(keys[start]), pixels(keys[end])
        ga, gb = gray(a), gray(b)
        estimator = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        forward = estimator.calc(ga, gb, None)
        backward = estimator.calc(gb, ga, None)
        for step in range(steps):
            t = step / steps
            frames.append(keys[start].copy() if step == 0 else
                          image(warp(a, forward, t) * (1 - t) + warp(b, backward, 1 - t) * t))
    if not loop:
        frames.append(keys[-1].copy())
    assert len(frames) == COUNT
    return frames


def save_atlas(frames, path):
    atlas = Image.new('RGBA', (GRID * CELL, GRID * CELL))
    for i, frame in enumerate(frames):
        if frame.getbbox() is None:
            raise ValueError(f'{path.name}: empty frame {i}')
        atlas.paste(frame, ((i % GRID) * CELL, (i // GRID) * CELL))
    atlas.save(path, lossless=True, quality=100, method=6, exact=True)
    # Decode the artifact, not just the encoder's settings: all RGBA channels
    # must survive, including RGB under transparent pixels.
    with Image.open(path) as decoded:
        if not np.array_equal(np.asarray(decoded.convert('RGBA')), np.asarray(atlas)):
            raise ValueError(f'{path}: lossless RGBA round-trip failed')
    print(f'{path.name}: {COUNT} frames, {GRID}x{GRID} grid, {CELL}px cells, '
          f'{GRID * CELL}x{GRID * CELL}, {FPS}fps, lossless RGBA verified, '
          f'{path.stat().st_size} bytes', flush=True)


def save_preview(groups, path, loop):
    previews = []
    for i in range(COUNT):
        canvas = Image.new('RGB', (CELL * len(groups), CELL * 2), '#FAF9F6')
        canvas.paste('#14213A', (0, CELL, canvas.width, CELL * 2))
        for column, frames in enumerate(groups):
            canvas.paste(frames[i], (column * CELL, 0), frames[i])
            canvas.paste(frames[i], (column * CELL, CELL), frames[i])
        previews.append(canvas)
    # WebP uses 0 for infinite repeats and 1 for a single playback. Pillow's
    # default is 0, so omitting this would accidentally loop the relief preview.
    options = {'loop': 0 if loop else 1}
    previews[0].save(path, save_all=True, append_images=previews[1:],
                     duration=DURATIONS, quality=95, **options)
    print(f'{path.name}: {COUNT} frames, {sum(DURATIONS)}ms, '
          f'{"loop" if loop else "play once"}, {path.stat().st_size} bytes', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--escalation-source', type=Path)
    parser.add_argument('--relief-source', type=Path)
    parser.add_argument('--output-dir', type=Path)
    args = parser.parse_args()
    output = (args.output_dir or OUT).resolve()
    if args.escalation_source or args.relief_source:
        if args.output_dir is None or output.is_relative_to((ROOT / 'assets').resolve()):
            parser.error('Override inputs require --output-dir outside repository assets')
    escalation = args.escalation_source or OUT / 'source/escalation-keyframes.png'
    relief = args.relief_source or OUT / 'source/relief-keyframes.png'
    # Validate both sheets before writing anything; a missing second sheet
    # must not leave what looks like a complete production generation.
    try:
        escalation_keys, relief_keys = load_keys(escalation), load_keys(relief)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    output.mkdir(parents=True, exist_ok=True)
    worried = interpolate(escalation_keys[:3], loop=True)
    alarmed = interpolate(escalation_keys[3:], loop=True)
    relieved = interpolate(relief_keys, loop=False)
    for name, frames in [('worried', worried), ('alarmed', alarmed), ('relieved', relieved)]:
        save_atlas(frames, output / f'{name}-smooth.webp')
    save_preview([worried, alarmed], output / 'escalation-preview.webp', loop=True)
    save_preview([relieved], output / 'relief-preview.webp', loop=False)


if __name__ == '__main__':
    main()

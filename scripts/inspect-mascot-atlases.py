#!/usr/bin/env python3
"""Inspect decoded production frames, including the wrap, without hiding edges.

Writes contact sheets and numerical diagnostics outside the shipping assets.
Numerical deltas locate transitions to scrub; they are not proof of good acting.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
args.output_dir.mkdir(parents=True, exist_ok=True)
report = {}
for path in sorted((ROOT / 'assets/mascot/3d').glob('*-smooth.webp')):
    if path.name == 'preview-smooth.webp':
        continue
    atlas = Image.open(path).convert('RGBA')
    assert atlas.width == atlas.height and atlas.width % 6 == 0
    cell = atlas.width // 6
    frames = [atlas.crop(((i % 6) * cell, (i // 6) * cell,
                         (i % 6 + 1) * cell, (i // 6 + 1) * cell)) for i in range(36)]
    arrays = [np.asarray(f).astype(np.float32) for f in frames]
    premul = [a[:, :, :3] * a[:, :, 3:4] / 255 for a in arrays]
    deltas = [float(np.abs(premul[(i + 1) % 36] - a).mean()) for i, a in enumerate(premul)]
    assert all(f.getbbox() for f in frames), path
    assert all(d > 0 for d in deltas), f'{path}: duplicate frames'
    mirror = [float(np.abs(premul[i] - premul[(-i) % 36]).mean()) for i in range(1, 18)]
    report[path.stem] = {'cell': cell, 'bytes': path.stat().st_size,
                         'computed_rgba_bytes': atlas.width * atlas.height * 4,
                         'wrap_mean_delta': deltas[-1], 'max_mean_delta': max(deltas),
                         'max_delta_after_frame': int(np.argmax(deltas)),
                         'median_mean_delta': float(np.median(deltas)),
                         'mirror_mean_delta': float(np.mean(mirror)),
                         'adjacent_mean_deltas': deltas}
    # Each labeled tile contains both backgrounds. All 36 frames are visible,
    # so the midpoint source switches cannot hide behind a hand-picked proof.
    tile = 144
    sheet = Image.new('RGB', (tile * 12, (tile + 20) * 6), '#FAF9F6')
    draw = ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        x, y = (i % 6) * tile * 2, (i // 6) * (tile + 20)
        sheet.paste('#14213A', (x + tile, y, x + tile * 2, y + tile))
        small = frame.resize((tile, tile), Image.Resampling.LANCZOS)
        sheet.paste(small, (x, y), small)
        sheet.paste(small, (x + tile, y), small)
        draw.text((x + 4, y + tile + 2), f'{i:02d}  next delta {deltas[i]:.2f}', fill='#14213A')
    sheet.save(args.output_dir / f'{path.stem}-contact.png')
(args.output_dir / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: {x: v[x] for x in ('cell', 'wrap_mean_delta', 'max_mean_delta', 'mirror_mean_delta')} for k, v in report.items()}, indent=2))

"""Prepare the approved AI sprite draft without erasing enclosed eyes/lens highlights."""
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/3d'
source = Image.open(OUT / 'source/generated-atlas-draft.png').convert('RGB')
rgb = np.asarray(source).astype(np.int16)
h, w = rgb.shape[:2]
neutral = (rgb.max(2) - rgb.min(2) < 28) & (rgb.min(2) > 145)
background = np.zeros((h, w), dtype=bool)
queue = deque()
for y in range(h):
    for x in (0, w - 1):
        if neutral[y, x]:
            background[y, x] = True
            queue.append((y, x))
for x in range(w):
    for y in (0, h - 1):
        if neutral[y, x] and not background[y, x]:
            background[y, x] = True
            queue.append((y, x))
while queue:
    y, x = queue.popleft()
    for yy, xx in ((y-1,x), (y+1,x), (y,x-1), (y,x+1)):
        if 0 <= yy < h and 0 <= xx < w and neutral[yy, xx] and not background[yy, xx]:
            background[yy, xx] = True
            queue.append((yy, xx))
rgba = np.dstack((rgb.astype(np.uint8), np.where(background, 0, 255).astype(np.uint8)))
cutout = Image.fromarray(rgba)
cutout.putalpha(cutout.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35)))
# The generated sheet is not an exact grid; these gutters were visually checked.
xs, ys = [0, 330, 640, 948, 1254], [0, 326, 614, 920, 1254]
atlas = Image.new('RGBA', (1280, 1280))
frames = []
for row in range(4):
    crops = []
    for col in range(4):
        crop = cutout.crop((xs[col], ys[row], xs[col+1], ys[row+1]))
        bounds = crop.getbbox()
        if bounds is None:
            raise ValueError('Empty mascot frame')
        crops.append(crop.crop(bounds))
    scale = min(280 / max(c.width for c in crops), 280 / max(c.height for c in crops))
    strip = []
    for col, crop in enumerate(crops):
        crop = crop.resize((round(crop.width*scale), round(crop.height*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (320, 320))
        frame.alpha_composite(crop, ((320-crop.width)//2, 300-crop.height))
        atlas.alpha_composite(frame, (col*320, row*320))
        strip.append(frame)
    frames.append(strip)
atlas.save(OUT / 'mascot-atlas.png', optimize=True)
# A standalone animated preview on the app's light surface.
preview = []
for index in [0, 1, 2, 3, 2, 1]:
    canvas = Image.new('RGB', (1280, 320), '#FAF9F6')
    for row in range(4):
        frame = frames[row][index if row != 3 else min(index, 2)]
        canvas.paste(frame, (row*320, 0), frame)
    preview.append(canvas)
preview[0].save(OUT / 'preview.webp', save_all=True, append_images=preview[1:], duration=260, loop=0, quality=90)
for target in ['share', 'add-share']:
    directory = ROOT / f'targets/{target}/Assets.xcassets/MascotAtlas.imageset'
    directory.mkdir(parents=True, exist_ok=True)
    atlas.save(directory / 'mascot-atlas.png', optimize=True)
print(f'Atlas: {atlas.size}; transparent source pixels: {background.sum()}; generated 16 aligned frames')

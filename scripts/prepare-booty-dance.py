"""Prepare a saved-only mascot dance; never touches application integration."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/animation-library/booty-dance'
source = Image.open(OUT / 'source.png').convert('RGBA')
rgb = np.asarray(source)[:, :, :3].astype(np.int16)
# Remove only border-connected neutral checkerboard, preserving white eyes.
neutral = ((rgb.max(2)-rgb.min(2) < 35) & (rgb.min(2) > 140)).astype(np.uint8)
_, labels = cv2.connectedComponents(neutral, connectivity=4)
edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
background = np.isin(labels, edge[edge != 0])
alpha = np.where(background, 0, np.asarray(source)[:, :, 3]).astype(np.uint8)
source.putalpha(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.35)))
source.save(OUT / 'keyframes.png', optimize=True)
# Animate one consistent generated pose; avoid identity morphing between poses.
pose = source.crop((0, 0, 512, 512)).resize((256, 256), Image.Resampling.LANCZOS)
base = np.asarray(pose).astype(np.float32)/255
base[:, :, :3] *= base[:, :, 3:4]
yy, xx = np.mgrid[:256, :256].astype(np.float32)
hip_weight = np.exp(-((yy-169)/36)**2)
body_weight = np.clip((238-yy)/70, 0, 1)
frames = []
for i in range(48):
    phase = 2*np.pi*i/48
    # Two playful hip swings in a two-second seamless loop; feet stay planted.
    sx = xx - 12*np.sin(2*phase)*hip_weight
    sy = yy + 3*(1-np.cos(4*phase))*body_weight
    p = cv2.remap(base, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    p[:, :, :3] = np.divide(p[:, :, :3], p[:, :, 3:4], out=np.zeros_like(p[:, :, :3]), where=p[:, :, 3:4] > .001)
    frames.append(Image.fromarray(np.uint8(np.clip(p*255, 0, 255))))
atlas = Image.new('RGBA', (2048, 1536))
previews = []
for i, frame in enumerate(frames):
    atlas.alpha_composite(frame, ((i%8)*256, (i//8)*256))
    bg = Image.new('RGB', (512, 256), '#FAF9F6')
    bg.paste('#14213A', (256, 0, 512, 256))
    bg.paste(frame, (0, 0), frame)
    bg.paste(frame, (256, 0), frame)
    previews.append(bg)
atlas.save(OUT / 'atlas.webp', lossless=True, exact=True, method=6)
durations = [round((i+1)*1000/24)-round(i*1000/24) for i in range(48)]
for images, name in [(frames, 'animation.webp'), (previews, 'preview.webp')]:
    images[0].save(OUT/name, save_all=True, append_images=images[1:], duration=durations, loop=0, lossless=True, exact=True, method=6)
assert all(frame.getchannel('A').getextrema() == (0, 255) for frame in frames)
print('Saved 48 transparent frames, 24fps, 2-second loop. No app integration.')

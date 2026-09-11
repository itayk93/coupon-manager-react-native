"""Key the generated six-seven poses and interpolate a transparent 24fps loop."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/3d'
CELL = 256
rgb = np.asarray(Image.open(OUT / 'source/six-seven-keyframes.png').convert('RGB')).astype(np.float32)
excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
alpha = 1 - np.clip(excess / 80, 0, 1)
rgb[:, :, 1] = np.minimum(rgb[:, :, 1], np.maximum(rgb[:, :, 0], rgb[:, :, 2]))
cutout = Image.fromarray(np.uint8(np.dstack((rgb, alpha*255))))
cutout.putalpha(cutout.getchannel('A').filter(ImageFilter.MinFilter(3)))
# Keep a fixed camera and body anchor; centering on each hand's bounding box
# would move the entire mascot as the hands rise.
keys = [cutout.crop(((i%3)*512,(i//3)*512,(i%3+1)*512,(i//3+1)*512)).resize((CELL,CELL), Image.Resampling.LANCZOS) for i in range(6)]
yy, xx = np.mgrid[:CELL,:CELL].astype(np.float32)

# Animate the generated neutral pose with a continuous deformation field.
# This keeps every finger intact: optical flow between occluding palms produced
# double hands. Both arms move in opposite phase; face and feet remain anchored.
def smoothstep(low, high, value):
    t = np.clip((value-low)/(high-low),0,1)
    return t*t*(3-2*t)

base = np.asarray(keys[2]).astype(np.float32)/255
base[:,:,:3] *= base[:,:,3:4]
left = 1-smoothstep(58,91,xx)
right = smoothstep(174,207,xx)
frames = []
for index in range(36):
    amplitude = 18*np.cos(2*np.pi*index/36)
    source_y = yy.copy()
    for _ in range(8):
        vertical = smoothstep(105,134,source_y)*(1-smoothstep(170,203,source_y))
        displacement = amplitude*(right-left)*vertical
        source_y = yy-displacement
    p = cv2.remap(base,xx,source_y.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    p[:,:,:3] = np.divide(p[:,:,:3],p[:,:,3:4],out=np.zeros_like(p[:,:,:3]),where=p[:,:,3:4]>0.001)
    frames.append(Image.fromarray(np.uint8(np.clip(p*255,0,255))))
atlas = Image.new('RGBA',(1536,1536))
preview = []
for i,frame in enumerate(frames):
    atlas.alpha_composite(frame,((i%6)*CELL,(i//6)*CELL))
    bg = Image.new('RGB',(CELL*2,CELL),'#FAF9F6')
    bg.paste('#14213A',(CELL,0,CELL*2,CELL))
    bg.paste(frame,(0,0),frame)
    bg.paste(frame,(CELL,0),frame)
    preview.append(bg)
# Lossless WebP: pixel-identical to PNG, ~40% smaller in the bundle.
atlas.save(OUT/'six-seven-smooth.webp',lossless=True,quality=100,method=6,exact=True)
preview[0].save(OUT/'six-seven-preview.webp',save_all=True,append_images=preview[1:],duration=[round((i+1)*1000/24)-round(i*1000/24) for i in range(36)],loop=0,quality=95)
Image.open(ROOT/'assets/mascot/celebration/C10-six-seven.png').convert('RGB').resize((600,600),Image.Resampling.LANCZOS).save(ROOT/'modules/coupon-widget/android/src/main/res/drawable-nodpi/celebration_67.webp',quality=94)
print('Six-seven: 36 frames, 24fps; widget uses the supplied artwork')

"""Export platform icon sizes from imagegen masters. Requires Pillow.
Run from any directory: python scripts/build-kuponi-icons.py
Artwork edits belong in the masters; this script only sizes/pads platform exports.
"""
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image, ImageChops, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
BG = '#e8f2fd'
face = Image.open(ROOT/'assets/branding/kuponi-face/face-transparent.png').convert('RGBA')
icon = Image.open(ROOT/'assets/branding/kuponi-face/icon-source.png').convert('RGB')
assert face.getextrema()[3][0] == 0

# Keep the diagonal artwork; normalize only its exported footprint. Source
# canvas margins are not balanced, so resizing the full source preserves drift.
# Blue silhouette bounds exclude the pale background and preserve facial detail.
silhouette = Image.new('L', icon.size)
silhouette.putdata([
    255 if blue - red > 60 and blue - green > 15 else 0
    for red, green, blue in icon.getdata()
])
bounds = silhouette.getbbox()
if bounds is None:
    raise ValueError('Icon source must contain the blue Kuponi silhouette')
# A square footprint gives all four sides the same 64px (6.25%) clearance.
framed_icon = Image.new('RGB', (1024, 1024), BG)
framed_icon.paste(icon.crop(bounds).resize((896, 896), Image.Resampling.LANCZOS), (64, 64))
icon = framed_icon

# Android draws a status-bar icon from its alpha channel alone, so the colour
# face arrives as a featureless white blob. The notification mark carries the
# face as transparency instead: body and eye whites fuse into one white shape,
# and the brows, pupils and smile are the holes that make it read as a face.
def notification_face():
    art = face.crop(face.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    body = art.getchannel('A')
    # convert('L') is 601 luma; the features are the only near-black ink here.
    ink = art.convert('L').point(lambda v: round(255 * (1 - min(1, max(0, (v - 40) / 32)))))
    ink = ImageChops.multiply(ink, body.point(lambda v: 255 if v > 8 else 0))
    # Opened at a fixed working width so the kernels stay proportional: erosion
    # drops the thin shading ring around each eye, which would otherwise
    # downscale into grey noise, and the wider dilation thickens what survives
    # so the brows and smile still read at 24px.
    scale = 384 / max(body.size)
    work = ink.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
    work = work.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
    out = Image.new('RGBA', art.size, (255, 255, 255, 0))
    out.putalpha(ImageChops.subtract(body, work.resize(art.size, Image.Resampling.LANCZOS)))
    return out

notification = notification_face()

def export(path, size, kind='icon'):
    if isinstance(size, int): size = (size, size)
    if kind in ('adaptive', 'maskable'):
        out = Image.new('RGBA', size, (0,0,0,0) if kind == 'adaptive' else BG)
        # 62% of canvas keeps the complete face inside the circular safe zone.
        n = round(min(size)*.62)
        fg = face.resize((n,n), Image.Resampling.LANCZOS)
        out.alpha_composite(fg, ((size[0]-n)//2,(size[1]-n)//2))
        if kind == 'maskable': out = out.convert('RGB')
    elif kind == 'notification':
        # 86% of the canvas: the tilted face needs clearance on every side or
        # Android clips it against the status-bar edge.
        out = Image.new('RGBA', size, (255, 255, 255, 0))
        n = min(size) * .86 / max(notification.size)
        fg = notification.resize(
            (round(notification.width * n), round(notification.height * n)), Image.Resampling.LANCZOS
        )
        out.alpha_composite(fg, ((size[0] - fg.width) // 2, (size[1] - fg.height) // 2))
    else:
        out = (face if kind == 'transparent' else icon).resize(size, Image.Resampling.LANCZOS)
    path = ROOT/path
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.stem + '.tmp' + path.suffix)
    if path.suffix == '.webp': out.save(temp, lossless=True)
    else: out.save(temp)
    temp.replace(path)

export('assets/icon.png',1024)
export('assets/adaptive-icon.png',1024,'adaptive')
export('assets/favicon.png',64,'transparent')
export('assets/brand-logo-kuponi.png',512,'transparent')
export('public/logo-icon.png',512,'transparent')
for filename, n in [('favicon.svg',64), ('logo-icon.svg',512)]:
    buffer=BytesIO()
    face.resize((n,n),Image.Resampling.LANCZOS).save(buffer,format='PNG')
    encoded=base64.b64encode(buffer.getvalue()).decode()
    (ROOT/'public'/filename).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}"><image width="{n}" height="{n}" href="data:image/png;base64,{encoded}"/></svg>\n')
for n in [16,32]: export(f'public/favicon-{n}x{n}.png',n,'transparent')
export('public/apple-touch-icon.png',180)
for n in [192,512]: export(f'public/pwa-{n}x{n}.png',n)
export('public/pwa-maskable-512x512.png',512,'maskable')
# Small icons that the OS masks: Android's status bar and the Web Push badge.
export('assets/notification-icon.png',512,'notification')
export('public/notification-badge.png',96,'notification')
face.resize((64,64),Image.Resampling.LANCZOS).save(ROOT/'public/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
# Checked-in native projects must agree with Expo's next prebuild.
for p in list((ROOT/'ios').glob('**/AppIcon.appiconset/*.png')) + list((ROOT/'targets').glob('**/AppIcon.appiconset/*.png')):
    with Image.open(p) as old: size=old.size
    export(p,size)
for p in (ROOT/'android/app/src/main/res').glob('mipmap-*/*.webp'):
    if not p.name.startswith('ic_launcher'): continue
    with Image.open(p) as old: size=old.size
    export(p,size,'adaptive' if 'foreground' in p.name else 'icon')
# expo-notifications resizes assets/notification-icon.png into these at
# prebuild (24dp baseline); the checked-in project has to carry them meanwhile.
for folder, n in [('mdpi',24),('hdpi',36),('xhdpi',48),('xxhdpi',72),('xxxhdpi',96)]:
    export(f'android/app/src/main/res/drawable-{folder}/notification_icon.png',n,'notification')
for p in list((ROOT/'ios').glob('**/SplashScreenLogo.imageset/*.png')) + list((ROOT/'android/app/src/main/res').glob('drawable-*/splashscreen_logo.png')):
    with Image.open(p) as old: size=old.size
    # Preserve canvas dimensions and aspect ratio of the face.
    out=Image.new('RGBA',size)
    n=min(size)
    out.alpha_composite(face.resize((n,n),Image.Resampling.LANCZOS),((size[0]-n)//2,(size[1]-n)//2))
    temp = p.with_name(p.stem + ".tmp.png")
    out.save(temp)
    temp.replace(p)
print('Exported Expo, native, PWA and transparent favicon assets')

# Wordmarks own public/logo.png and native splash artwork.
import runpy
runpy.run_path(str(ROOT / "scripts/build-kuponi-wordmarks.py"), run_name="__main__")

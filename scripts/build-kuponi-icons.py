"""Export platform icon sizes from imagegen masters. Requires Pillow.
Run from any directory: python scripts/build-kuponi-icons.py
Artwork edits belong in the masters; this script only sizes/pads platform exports.
"""
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image
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

def export(path, size, kind='icon'):
    if isinstance(size, int): size = (size, size)
    if kind in ('adaptive', 'maskable'):
        out = Image.new('RGBA', size, (0,0,0,0) if kind == 'adaptive' else BG)
        # 62% of canvas keeps the complete face inside the circular safe zone.
        n = round(min(size)*.62)
        fg = face.resize((n,n), Image.Resampling.LANCZOS)
        out.alpha_composite(fg, ((size[0]-n)//2,(size[1]-n)//2))
        if kind == 'maskable': out = out.convert('RGB')
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
face.resize((64,64),Image.Resampling.LANCZOS).save(ROOT/'public/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
# Checked-in native projects must agree with Expo's next prebuild.
for p in list((ROOT/'ios').glob('**/AppIcon.appiconset/*.png')) + list((ROOT/'targets').glob('**/AppIcon.appiconset/*.png')):
    with Image.open(p) as old: size=old.size
    export(p,size)
for p in (ROOT/'android/app/src/main/res').glob('mipmap-*/*.webp'):
    if not p.name.startswith('ic_launcher'): continue
    with Image.open(p) as old: size=old.size
    export(p,size,'adaptive' if 'foreground' in p.name else 'icon')
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

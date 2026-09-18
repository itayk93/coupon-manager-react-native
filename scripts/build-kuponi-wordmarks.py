#!/usr/bin/env python3
"""Export approved transparent Hebrew wordmarks; retain English source assets."""
from pathlib import Path
import json
import os
from io import BytesIO
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'assets/branding/kuponi-wordmark'

def save(image, path):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.stem + '.tmp.png')
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    with temporary.open("wb") as output:
        output.write(buffer.getvalue())
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(path)

def fit(image, size):
    canvas = Image.new('RGBA', size)
    foreground = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(foreground, ((size[0]-foreground.width)//2, (size[1]-foreground.height)//2))
    return canvas

marks = {}
for name in ('color-horizontal', 'color-stacked', 'white-horizontal', 'white-stacked'):
    original = Image.open(BRAND / 'source' / f'{name}.png').convert('RGBA')
    assert original.getchannel('A').getextrema()[0] == 0
    # Trim transparent canvas only; preserve the approved art, bevels and shadows.
    #
    # Thresholded, because `getbbox()` counts any alpha above zero and the
    # generated source carries a halo of 1-8 alpha reaching ~190px past the
    # artwork. Cropping to that kept the halo as if it were art: the wordmark
    # then had to shrink to fit the export canvas, so it landed at roughly half
    # the height it should have, wrapped in invisible padding that read on
    # screen as a gap nobody could find in the layout.
    #
    # 8 is comfortably below the real bevel and drop shadow — between alpha 8
    # and 128 the artwork's own box only moves by a few pixels, so the shadow
    # survives the crop intact.
    alpha = original.getchannel('A')
    cropped = original.crop(alpha.point(lambda value: 255 if value > 8 else 0).getbbox())
    cropped = ImageOps.expand(cropped, border=12, fill=(0, 0, 0, 0))
    size = (1200, 240) if name.endswith('horizontal') else (900, 900)
    marks[name] = fit(cropped, size)
    save(marks[name], BRAND / f'{name}.png')

save(marks['color-horizontal'], 'public/logo.png')
save(marks['color-horizontal'], 'public/newsletter-logo.png')
asset = ROOT / 'targets/widget/Assets.xcassets/KuponiWordmarkWhite.imageset'
images = []
for scale in (1, 2, 3):
    filename = 'KuponiWordmarkWhite' + (f'@{scale}x' if scale > 1 else '') + '.png'
    save(fit(marks['white-horizontal'], (240*scale, 48*scale)), asset / filename)
    images.append({'filename': filename, 'idiom': 'universal', 'scale': f'{scale}x'})
(asset / 'Contents.json').write_text(json.dumps({'images': images, 'info': {'author': 'xcode', 'version': 1}}, indent=2) + '\n')
save(fit(marks['white-horizontal'], (720, 144)), 'modules/coupon-widget/android/src/main/res/drawable-nodpi/kuponi_wordmark_white.png')
# Keep checked-in native splash artwork consistent with app.json / JS launch.
for path in list((ROOT/'ios').glob('**/SplashScreenLogo.imageset/*.png')) + list((ROOT/'android/app/src/main/res').glob('drawable-*/splashscreen_logo.png')):
    with Image.open(path) as existing:
        size = existing.size
    save(fit(marks['color-stacked'], size), path)
print('Exported Hebrew color and white wordmarks, widgets and native splash assets')

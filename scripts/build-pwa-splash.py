"""Export the iOS launch screens the installed web app shows. Requires Pillow.
Run from any directory: python3 scripts/build-pwa-splash.py

iOS is the only platform that will not draw a PWA's launch screen from the web
app manifest: with no `apple-touch-startup-image` to match the device, tapping
the home-screen icon opens a white page and holds it until the bundle has
booted. So this is the native `expo-splash-screen` launch, redrawn as a PNG per
device: the stacked wordmark at 240pt on the brand tint, the same artwork,
width and background `app.json` gives the native builds.

Artwork edits belong in the wordmark masters; this script only sizes them.
It writes `public/splash/`, and `src/lib/webHeadStartupImages.json` — the link
tags `webDocumentHead.ts` and `inject-web-head.mjs` put in the served HTML.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BG = (0xE8, 0xF2, 0xFD)  # #e8f2fd, the brand tint the native splash uses.
LOGO_WIDTH = 240  # Points. `app.json` -> expo-splash-screen -> imageWidth.
# A palette keeps a screen-sized render of glossy 3D artwork near 100KB instead
# of half a megabyte. At 96 colours the gradients stay smooth on device.
PALETTE = 96

# Every iPhone and iPad size iOS reports, in points, with its pixel ratio. A
# device missing from this table matches no media query and launches white, so
# retired models stay. Names are what the size covers, not an exhaustive list.
DEVICES = [
    ("iPhone SE (1st gen), 5s", 320, 568, 2),
    ("iPhone SE (2nd/3rd gen), 8, 7, 6s", 375, 667, 2),
    ("iPhone 8 Plus, 7 Plus, 6s Plus", 414, 736, 3),
    ("iPhone X, XS, 11 Pro, 12 mini, 13 mini", 375, 812, 3),
    ("iPhone XR, 11", 414, 896, 2),
    ("iPhone XS Max, 11 Pro Max", 414, 896, 3),
    ("iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e", 390, 844, 3),
    ("iPhone 14 Pro, 15, 15 Pro, 16", 393, 852, 3),
    ("iPhone 16 Pro, 17, 17 Pro", 402, 874, 3),
    ("iPhone Air", 420, 912, 3),
    ("iPhone 12 Pro Max, 13 Pro Max, 14 Plus", 428, 926, 3),
    ("iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus", 430, 932, 3),
    ("iPhone 16 Pro Max, 17 Pro Max", 440, 956, 3),
    ("iPad mini (6th/7th gen)", 744, 1133, 2),
    ("iPad 9.7\", iPad mini 4/5", 768, 1024, 2),
    ("iPad 10.2\"", 810, 1080, 2),
    ("iPad Air 10.9\", iPad (10th gen)", 820, 1180, 2),
    ("iPad Pro 10.5\", iPad Air 10.5\"", 834, 1112, 2),
    ("iPad Pro 11\" (1st-4th gen), iPad Air 11\"", 834, 1194, 2),
    ("iPad Pro 11\" (M4)", 834, 1210, 2),
    ("iPad Pro 12.9\"", 1024, 1366, 2),
    ("iPad Pro 13\" (M4)", 1032, 1376, 2),
]

wordmark = Image.open(ROOT / "assets/branding/kuponi-wordmark/color-stacked.png").convert("RGBA")
out_dir = ROOT / "public/splash"
out_dir.mkdir(parents=True, exist_ok=True)


def render(width_px: int, height_px: int, logo_px: int) -> Image.Image:
    """The wordmark centred on the tint, at the size the native splash draws."""
    canvas = Image.new("RGB", (width_px, height_px), BG)
    art = wordmark.resize((logo_px, logo_px), Image.Resampling.LANCZOS)
    # Rounded, not floored: a browser centring the same wordmark with flexbox
    # lands on the half pixel, and the two have to agree for the handover from
    # the iOS launch image to the document's own launch screen to be invisible.
    canvas.paste(art, (round((width_px - logo_px) / 2), round((height_px - logo_px) / 2)), art)
    return canvas.quantize(colors=PALETTE, method=Image.Quantize.MEDIANCUT)


links = []
written = {}  # Pixel size already drawn, and the logo size it was drawn at.
for _name, width_pt, height_pt, scale in DEVICES:
    logo_px = round(LOGO_WIDTH * scale)
    for orientation, (w_pt, h_pt) in (
        ("portrait", (width_pt, height_pt)),
        ("landscape", (height_pt, width_pt)),
    ):
        w_px, h_px = w_pt * scale, h_pt * scale
        href = f"/splash/launch-{w_px}x{h_px}.png"
        if href not in written:
            written[href] = logo_px
            render(w_px, h_px, logo_px).save(ROOT / f"public{href}", optimize=True)
        # Two devices of the same pixel size but different ratios would want the
        # same file at two logo sizes, and the second would silently take the
        # first one's. No such pair exists today; this is what says so.
        assert written[href] == logo_px, f"{href} wanted at {logo_px}px and {written[href]}px"
        links.append(
            {
                "rel": "apple-touch-startup-image",
                "href": href,
                # iOS reports the device's natural size in both orientations, so
                # only `orientation` tells the pair apart.
                "media": (
                    f"(device-width: {width_pt}px) and (device-height: {height_pt}px) "
                    f"and (-webkit-device-pixel-ratio: {scale}) and (orientation: {orientation})"
                ),
            }
        )

# The same wordmark for the document's own launch screen, which covers the gap
# between the iOS launch image and React's first paint (and is all Android and
# the desktop get). Opaque on the same tint rather than transparent: the tint is
# what it sits on either way, and dropping an alpha channel that the artwork
# feathers to black at the edges is how a logo picks up a dirty outline.
BOOT_PX = LOGO_WIDTH * 3  # 240pt, at the densest ratio any device asks for.
render(BOOT_PX, BOOT_PX, BOOT_PX).save(ROOT / "public/splash/wordmark.png", optimize=True)

(ROOT / "src/lib/webHeadStartupImages.json").write_text(
    json.dumps(links, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
)

total = sum(path.stat().st_size for path in out_dir.glob("*.png"))
print(f"build-pwa-splash: {len(written) + 1} images, {len(links)} links, {total / 1024:.0f} KB total")

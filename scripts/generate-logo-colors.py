#!/usr/bin/env python3
"""
Extract the dominant brand colour of every logo in public/legacy-images and
write src/lib/companyLogoColors.ts.

Run after adding logos:  npm run logo-colors

Method: drop transparent / near-white / near-black pixels (paper and outlines
are not brand colours), bucket the rest in coarse RGB bins, then score each
bucket by pixel count weighted by saturation so a small saturated mark beats a
large grey wash. Buckets are averaged for a smooth result.
"""
import colorsys
import json
import os
from collections import defaultdict

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "legacy-images")
OUT = os.path.join(ROOT, "src", "lib", "companyLogoColors.ts")
SKIP = {"default.png", "default_logo.png", "google-logo.png"}
BIN = 24  # RGB bucket size


def dominant(path):
    img = Image.open(path).convert("RGBA")
    img.thumbnail((160, 160))
    px = [p for p in img.getdata() if p[3] >= 128]
    if not px:
        return None

    buckets = defaultdict(float)
    saturated = 0
    for r, g, b, _a in px:
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if l > 0.93 or l < 0.07:  # paper white / pure black
            continue
        if s < 0.18:  # grey wash, not a brand colour
            continue
        # Saturated, mid-lightness pixels carry the brand identity.
        saturated += 1
        buckets[(r // BIN, g // BIN, b // BIN)] += 0.25 + s * (1 - abs(l - 0.5))

    key = max(buckets, key=buckets.get) if buckets else None
    members = (
        [p for p in px if (p[0] // BIN, p[1] // BIN, p[2] // BIN) == key] if key else []
    )

    # A wordmark in plain black or grey has no saturated bucket worth using;
    # its ink is the brand colour (Vans, Polgat, Fox Home).
    if saturated < len(px) * 0.03 or not members:
        ink = [p for p in px if sum(p[:3]) / 3 < 140]
        if len(ink) < len(px) * 0.02:
            return None
        members = ink

    r = sum(p[0] for p in members) // len(members)
    g = sum(p[1] for p in members) // len(members)
    b = sum(p[2] for p in members) // len(members)

    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.15:  # ink: settle on the app's near-black rather than a muddy grey
        return "#22252b"
    if l > 0.72:  # very light brand colour, darken to stay a usable surface
        r, g, b = (round(c * 255) for c in colorsys.hls_to_rgb(h, 0.62, s))
    elif l < 0.12:  # near-black with a hue, lift it off pure black
        r, g, b = (round(c * 255) for c in colorsys.hls_to_rgb(h, 0.16, s))

    return "#%02x%02x%02x" % (r, g, b)


def main():
    result = {}
    for name in sorted(os.listdir(SRC)):
        if name in SKIP or name.startswith("."):
            continue
        if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif")):
            continue
        try:
            color = dominant(os.path.join(SRC, name))
        except Exception as err:  # unreadable/unsupported file
            print(f"skip {name}: {err}")
            continue
        if color:
            result[name] = color

    lines = [
        "/**",
        " * Dominant brand colour per logo file — GENERATED, do not edit by hand.",
        " *",
        " * Regenerate after adding logos to public/legacy-images:",
        " *   npm run logo-colors",
        " */",
        "export const logoColorByFile: Record<string, string> = {",
    ]
    for name, color in result.items():
        lines.append(f'  {json.dumps(name, ensure_ascii=False)}: "{color}",')
    lines.append("};")
    with open(OUT, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"wrote {len(result)} colours to {OUT}")


if __name__ == "__main__":
    main()

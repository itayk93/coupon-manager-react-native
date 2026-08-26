from __future__ import annotations

import argparse
import math
import subprocess
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "onboarding"
OUT = ASSETS / "videos"
SIZE = 1080
FPS = 30
SECONDS = 5


def cutout(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(box).convert("RGBA")
    pixels = crop.load()
    width, height = crop.size
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) > 225 and max(r, g, b) - min(r, g, b) < 22

    for x in range(width):
        for y in (0, height - 1):
            if background(x, y):
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if background(x, y):
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index] or not background(x, y):
            continue
        seen[index] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                queue.append((nx, ny))

    mask = Image.new("L", crop.size, 255)
    alpha = mask.load()
    for y in range(height):
        for x in range(width):
            if seen[y * width + x]:
                alpha[x, y] = 0
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    crop.putalpha(mask)
    return crop


def cutout_black(image: Image.Image) -> Image.Image:
    crop = image.convert("RGBA")
    pixels = crop.load()
    width, height = crop.size
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return r < 105 and g < 125 and b < 185

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index] or not background(x, y):
            continue
        seen[index] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                queue.append((nx, ny))
    mask = Image.new("L", crop.size, 255)
    alpha = mask.load()
    for y in range(height):
        for x in range(width):
            if seen[y * width + x]:
                alpha[x, y] = 0
    crop.putalpha(mask.filter(ImageFilter.GaussianBlur(1.1)))
    bounds = crop.getbbox()
    return crop.crop(bounds) if bounds else crop


def place(canvas: Image.Image, sprite: Image.Image, center: tuple[float, float], angle: float = 0, scale: float = 1) -> None:
    width = max(1, round(sprite.width * scale))
    height = max(1, round(sprite.height * scale))
    layer = sprite.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        layer = layer.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    x = round(center[0] - layer.width / 2)
    y = round(center[1] - layer.height / 2)
    canvas.alpha_composite(layer, (x, y))


def encode(frame_dir: Path, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(frame_dir / "%04d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(output),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_ai() -> None:
    base = Image.open(ASSETS / "ai-scan-coupon.png").convert("RGBA")
    blue = cutout_black(Image.open(ASSETS / "blue-investigator.png"))
    mint = cutout_black(Image.open(ASSETS / "mint-helper.png"))
    frames = OUT / "ai-frames"
    frames.mkdir(parents=True, exist_ok=True)

    for index in range(FPS * SECONDS):
        t = index / FPS
        canvas = Image.new("RGBA", (SIZE, SIZE), "#F7F9FC")
        investigate = min(1, t / 1.3)
        found = max(0, min(1, (t - 2.8) / 0.55))
        blue_bob = math.sin(t * 4.1) * 7
        mint_bob = math.sin(t * 4.1 + 1.2) * 8
        place(canvas, base, (540, 510), angle=0, scale=0.78)
        place(canvas, blue, (245 + investigate * 35, 690 + blue_bob), angle=-4 + math.sin(t * 3) * 2.5, scale=0.28)
        place(canvas, mint, (820 - found * 18, 700 + mint_bob), angle=3 + math.sin(t * 3 + 1) * 2, scale=0.27 + found * 0.012)
        if 0.45 < t < 3.45:
            y = 360 + ((t - 0.45) * 235) % 310
            draw = ImageDraw.Draw(canvas, "RGBA")
            draw.rounded_rectangle((255, y, 825, y + 9), radius=5, fill=(88, 223, 198, 205))
        if found > 0:
            draw = ImageDraw.Draw(canvas, "RGBA")
            radius = 9 + 10 * found
            for x, y in ((420, 300), (670, 325), (725, 440)):
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 196, 45, round(210 * found)))
        canvas.convert("RGB").save(frames / f"{index:04d}.png", quality=92)
    encode(frames, OUT / "ai-characters-moving.mp4")


def render_saved() -> None:
    wallet = Image.open(ASSETS / "coupon-saved.png").convert("RGBA")
    left = cutout_black(Image.open(ASSETS / "blue-investigator.png"))
    right = cutout_black(Image.open(ASSETS / "mint-helper.png"))
    frames = OUT / "saved-frames"
    frames.mkdir(parents=True, exist_ok=True)

    for index in range(FPS * SECONDS):
        t = index / FPS
        canvas = Image.new("RGBA", (SIZE, SIZE), "white")
        push = max(0, min(1, t / 1.35))
        celebrate = max(0, min(1, (t - 1.55) / 0.45))
        settle = math.exp(-max(0, t - 1.4) * 2.2) * math.sin(max(0, t - 1.4) * 11) * 14
        place(canvas, wallet, (540, 505 + settle), angle=0, scale=0.72)
        place(canvas, left, (235 + push * 42, 720 - push * 10 + math.sin(t * 5) * 5), angle=-7 + push * 6, scale=0.27)
        hop = abs(math.sin((t - 1.55) * 5.5)) * 30 * celebrate
        place(canvas, right, (825, 710 - hop), angle=5 * math.sin(t * 5) * celebrate, scale=0.26 + 0.012 * celebrate)
        if celebrate > 0:
            draw = ImageDraw.Draw(canvas, "RGBA")
            pulse = 12 + 8 * abs(math.sin(t * 5))
            for x, y in ((445, 245), (685, 265), (735, 365)):
                draw.ellipse((x - pulse, y - pulse, x + pulse, y + pulse), fill=(255, 196, 45, 220))
        canvas.convert("RGB").save(frames / f"{index:04d}.png", quality=92)
    encode(frames, OUT / "coupon-characters-moving.mp4")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("scene", choices=("all", "ai", "saved"), nargs="?", default="all")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.scene in ("all", "ai"):
        render_ai()
    if args.scene in ("all", "saved"):
        render_saved()

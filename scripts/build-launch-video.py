"""Cut the launch video and its poster from the source clip. Requires ffmpeg, Pillow and numpy.
Run from any directory: python3 scripts/build-launch-video.py

The source is a 716x1280 portrait clip with the mascot and wordmark in its
upper half, a backdrop a few shades darker than the brand tint, and a generator
watermark in the corner.

This preserves the full animation, crops to a square around the logo with the logo centred,
and puts it on #e8f2fd: away from the logo the backdrop becomes the tint
outright (it carries the generator's compression blocks, which show on a flat
colour), and in a soft halo around the logo it is shifted onto the tint by a
per-pixel estimate of the backdrop's gradient, which keeps the logo's edges and
shadow as they were. The crop's edges are feathered into the tint as well, so
the square has no visible border on it. The poster is the encoded video's
own first frame: the native splash draws it, `BrandLaunchAnimation` draws it
under the video, and the video starts on it, so the launch has no cut in it.

Writes `assets/branding/launch/`, and the Android splash drawables: Android 12+
masks the splash icon to a 192dp circle, which would crop the square poster,
so Android draws the tint alone and the app's launch overlay brings the logo in.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/branding/launch/source/opening-screen-silent.mp4"
OUT = ROOT / "assets/branding/launch"
BG = (0xE8, 0xF2, 0xFD)  # #e8f2fd, the brand tint the native splash uses.

# Preserve all 121 source frames (24fps, 5.04s), including the magnifier motion.
FIRST_FRAME, LAST_FRAME = 0, 120
FPS = 24
# The logo's bounding box over those frames, in source pixels.
LOGO_BOX = (40, 137, 690, 796)
SIZE = 736  # Square output: the logo plus a little tint around it.
FEATHER = 16  # Pixels over which the crop's edge fades into the tint.
# The halo around the logo that keeps its own pixels, and the width of its
# soft edge; past it everything is the tint.
HALO = 24
HALO_EDGE = 18
BACKDROP_RADIUS = 48
COLOR_TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]

# Android splash drawables: a transparent 288dp canvas per density, the size
# expo-splash-screen writes, so the system splash is the tint alone.
ANDROID_RES = ROOT / "android/app/src/main/res"
ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def feather_mask(box: tuple[int, int, int, int]) -> Image.Image:
    """Opaque inside `box`, ramping to transparent over FEATHER px at its edges."""
    x0, y0, x1, y1 = box
    mask = Image.new("L", (SIZE, SIZE), 0)
    px = mask.load()
    for y in range(max(y0, 0), min(y1, SIZE)):
        for x in range(max(x0, 0), min(x1, SIZE)):
            edge = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
            px[x, y] = min(255, round(255 * (edge + 1) / FEATHER))
    return mask


def box_blur(a: np.ndarray, radius: int) -> np.ndarray:
    """Three passes of a separable box blur, which is close to a Gaussian."""
    for _ in range(3):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (radius + 1, radius)
            c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
            hi = np.take(c, range(2 * radius + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * radius - 1), axis=axis)
            a = (hi - lo) / (2 * radius + 1)
    return a


def onto_tint(frame: Image.Image) -> Image.Image:
    """The logo and a soft halo of its surroundings on the tint; the rest, tint."""
    rgb = np.asarray(frame, dtype=np.float64)
    tint = np.array(BG, dtype=np.float64)
    # Anything this far from the pale backdrop is the logo.
    logo = ((rgb[..., 0] < 205) | (rgb[..., 1] < 215)).astype(np.float64)
    halo = (box_blur(logo, HALO // 3) > 0).astype(np.float64)
    keep = np.clip(box_blur(halo, HALO_EDGE // 3), 0, 1)[..., None]
    # The backdrop's own colour under the halo, from the backdrop around it.
    backdrop = 1 - halo
    weight = box_blur(backdrop, BACKDROP_RADIUS // 3)[..., None]
    estimate = box_blur(rgb * backdrop[..., None], BACKDROP_RADIUS // 3)
    fallback = rgb[backdrop > 0].mean(axis=0)
    estimate = np.where(weight > 1e-3, estimate / np.maximum(weight, 1e-3), fallback)
    out = keep * (rgb + tint - estimate) + (1 - keep) * tint
    return Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    src_w = 716
    logo_cx = (LOGO_BOX[0] + LOGO_BOX[2]) / 2
    logo_cy = (LOGO_BOX[1] + LOGO_BOX[3]) / 2
    # Crop the full source width and SIZE rows around the logo, and place it so
    # the logo's centre is the square's centre; the tint fills what is left.
    crop_y = round(logo_cy - SIZE / 2)
    place_x = round(SIZE / 2 - logo_cx)
    mask = feather_mask((place_x, 0, place_x + src_w, SIZE))

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        ffmpeg(
            "-i", str(SOURCE),
            "-vf", f"select='between(n,{FIRST_FRAME},{LAST_FRAME})',crop={src_w}:{SIZE}:0:{crop_y}",
            "-fps_mode", "passthrough", str(tmp / "in%03d.png"),
        )
        frames = sorted(tmp.glob("in*.png"))
        assert len(frames) == LAST_FRAME - FIRST_FRAME + 1, f"got {len(frames)} frames"
        for i, path in enumerate(frames):
            layer = Image.new("RGB", (SIZE, SIZE), BG)
            layer.paste(onto_tint(Image.open(path).convert("RGB")), (place_x, 0))
            Image.composite(layer, Image.new("RGB", (SIZE, SIZE), BG), mask).save(tmp / f"out{i:03d}.png")

        video = OUT / "launch-video.mp4"
        ffmpeg(
            "-framerate", str(FPS), "-i", str(tmp / "out%03d.png"),
            "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-preset", "veryslow", "-crf", "16",
            *COLOR_TAGS, "-movflags", "+faststart", "-an", str(video),
        )
        # The poster is the video's first frame as a player decodes it, not the
        # frame that went in, so the two match to the level.
        ffmpeg(
            "-i", str(video), "-frames:v", "1",
            "-vf", "scale=in_color_matrix=bt709:in_range=tv,format=rgb24", str(tmp / "poster.png"),
        )
        poster = Image.open(tmp / "poster.png").convert("RGB")
        poster.save(OUT / "launch-poster.png", optimize=True)
        # Keep the checked-in iOS launch artwork aligned without a full prebuild.
        ios_images = ROOT / "ios/CouponMaster/Images.xcassets/SplashScreenLogo.imageset"
        for scale in (1, 2, 3):
            suffix = "" if scale == 1 else f"@{scale}x"
            poster.resize((240 * scale, 240 * scale), Image.Resampling.LANCZOS).save(
                ios_images / f"image{suffix}.png", optimize=True
            )
        # The corners have to land on the tint itself, or the square shows.
        corner = poster.getpixel((0, 0))
        assert max(abs(a - b) for a, b in zip(corner, BG)) <= 2, f"poster corner {corner} is off the tint"

    for density, scale in ANDROID_DENSITIES.items():
        side = round(288 * scale)
        Image.new("RGBA", (side, side), (0, 0, 0, 0)).save(
            ANDROID_RES / f"drawable-{density}/splashscreen_logo.png", optimize=True
        )
    # expo-splash-screen's `android.image` for prebuild; it pads it the same way.
    Image.new("RGBA", (16, 16), (0, 0, 0, 0)).save(OUT / "android-splash-blank.png", optimize=True)

    print(f"build-launch-video: {video.stat().st_size / 1024:.0f} KB video, "
          f"{(OUT / 'launch-poster.png').stat().st_size / 1024:.0f} KB poster")


if __name__ == "__main__":
    shutil.which("ffmpeg") or exit("build-launch-video: ffmpeg is not on PATH")
    main()

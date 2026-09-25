"""Rigid cut-out compositor for Kuponi.

Every layer is scaled once, uniformly, when the rig loads. After that a frame
can only move a layer (translate), turn it about its pivot, or hide it. There
is no optical flow, no displacement field and no per-axis scaling anywhere in
this module, so the body in frame 17 is the same pixels as the body in frame 0,
merely placed differently. That is the whole point: the old atlases were morphs
between separately drawn poses, and the morph is what made him stretch.

Coordinates are "canonical space": the pixel grid of
`assets/mascot/original_app_mascot.png`, the approved reference. A layer is
placed by saying where the centre of its artwork's bounding box lands in that
space and how wide it is there.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Layer:
    name: str
    rgba: np.ndarray          # premultiplied float32, H x W x 4, at render scale
    origin: tuple[float, float]  # render-space position of the array's (0,0)
    clip: str | None = None   # draw only inside this other layer's alpha


def premultiply(rgba: np.ndarray) -> np.ndarray:
    out = rgba.astype(np.float32) / 255.0
    out[..., :3] *= out[..., 3:4]
    return out


def unpremultiply(pm: np.ndarray) -> np.ndarray:
    alpha = pm[..., 3:4]
    rgb = np.where(alpha > 1e-6, pm[..., :3] / np.maximum(alpha, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)], axis=-1)
    return (out * 255 + 0.5).astype(np.uint8)


def artwork_box(img: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(img[..., 3] > 16)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def anchored_centre(path: Path, width: float, pivot_src, anchor) -> tuple[float, float]:
    """Where the artwork's box centre must go so that the source pixel
    `pivot_src` (a wrist or shoulder stub) lands on the canonical `anchor`."""
    x0, x1, y0, y1 = artwork_box(np.array(Image.open(path).convert("RGBA")))
    factor = width / (x1 - x0)
    return (anchor[0] - (pivot_src[0] - (x0 + x1) / 2) * factor,
            anchor[1] - (pivot_src[1] - (y0 + y1) / 2) * factor)


def load_part(path: Path, width: float, centre: tuple[float, float], render_scale: float):
    """Crop to the artwork and scale it uniformly so its box is `width` wide."""
    img = np.array(Image.open(path).convert("RGBA"))
    x0, x1, y0, y1 = artwork_box(img)
    crop = premultiply(img[y0:y1, x0:x1])
    factor = width * render_scale / (x1 - x0)
    size = (max(1, round((x1 - x0) * factor)), max(1, round((y1 - y0) * factor)))
    # One uniform factor for both axes; INTER_AREA on premultiplied values keeps
    # the edges free of dark or white fringes.
    scaled = cv2.resize(crop, size, interpolation=cv2.INTER_AREA)
    cx, cy = centre[0] * render_scale, centre[1] * render_scale
    return scaled, (cx - size[0] / 2, cy - size[1] / 2)


class Rig:
    def __init__(self, spec_path: Path | dict, render_scale: float, base: Path | None = None):
        """`spec_path` is a rig.json, or the same structure as a dict with
        `base` the folder its file names are relative to."""
        if isinstance(spec_path, dict):
            spec = spec_path
        else:
            spec = json.loads(spec_path.read_text())
            base = spec_path.parent
        self.spec = spec
        self.scale = render_scale
        win = spec["window"]
        self.window = win
        self.size = round(win["size"] * render_scale)
        self.layers: dict[str, Layer] = {}
        self.order: list[str] = []
        self.pivots: dict[str, tuple[float, float]] = {}
        self.rest: dict[str, tuple] = {}
        for entry in spec["layers"]:
            if "anchor" in entry:
                # Placed by its attachment point: the stub goes on the body.
                entry.setdefault("centre", anchored_centre(base / entry["file"], entry["width"],
                                                           entry["pivot_src"], entry["anchor"]))
                entry.setdefault("pivot", entry["anchor"])
            rgba, origin = load_part(base / entry["file"], entry["width"],
                                     tuple(entry["centre"]), render_scale)
            if entry.get("angle"):
                # A fixed rest rotation about the pivot, applied before any motion.
                self.rest[entry["name"]] = (0.0, 0.0, entry["angle"], tuple(entry["pivot"]))
            # Window offset folded into the origin so frames render directly.
            origin = (origin[0] - win["x"] * render_scale, origin[1] - win["y"] * render_scale)
            self.layers[entry["name"]] = Layer(entry["name"], rgba, origin, entry.get("clip"))
            self.order.append(entry["name"])
            if "pivot" in entry:
                self.pivots[entry["name"]] = tuple(entry["pivot"])
        self.groups: dict[str, list[str]] = spec.get("groups", {})

    def to_render(self, point):
        return ((point[0] - self.window["x"]) * self.scale, (point[1] - self.window["y"]) * self.scale)

    def render(self, transforms: dict[str, list[tuple]], hidden: set[str]) -> np.ndarray:
        """`transforms[name]` is a list of (dx, dy, degrees, pivot) applied in
        order, outermost last. dx/dy are canonical pixels; pivot is canonical."""
        canvas = np.zeros((self.size, self.size, 4), np.float32)
        placed: dict[str, np.ndarray] = {}
        for name in self.order:
            if name in hidden:
                continue
            layer = self.layers[name]
            m = np.array([[1, 0, layer.origin[0]], [0, 1, layer.origin[1]], [0, 0, 1]], np.float64)
            steps = ([self.rest[name]] if name in self.rest else []) + list(transforms.get(name, []))
            for dx, dy, degrees, pivot in steps:
                px, py = self.to_render(pivot)
                rad = math.radians(degrees)
                c, s = math.cos(rad), math.sin(rad)
                # Rotation is orthonormal: the determinant is exactly 1, so the
                # layer keeps its area and its proportions.
                rot = np.array([[c, -s, px - c * px + s * py], [s, c, py - s * px - c * py], [0, 0, 1]])
                move = np.array([[1, 0, dx * self.scale], [0, 1, dy * self.scale], [0, 0, 1]])
                m = move @ rot @ m
            warped = cv2.warpAffine(layer.rgba, m[:2], (self.size, self.size),
                                    flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            warped = np.clip(warped, 0, 1)
            warped[..., :3] = np.minimum(warped[..., :3], warped[..., 3:4])
            if layer.clip:
                warped *= placed[layer.clip][..., 3:4]
            placed[name] = warped
            canvas = warped + canvas * (1 - warped[..., 3:4])
        return canvas


def downsample(pm: np.ndarray, cell: int) -> np.ndarray:
    return cv2.resize(pm, (cell, cell), interpolation=cv2.INTER_AREA)

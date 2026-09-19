"""Periodic deformation and review playback shared by the atlas builders.

Only existing pixels move. All sampling uses premultiplied alpha so transparent
RGB cannot leak into the blue silhouette. Cell sizes stay local to each builder.
"""
from math import gcd, lcm
import cv2
import numpy as np
from PIL import Image


def breathe(frames, amplitude):
    if not amplitude:
        return frames
    cell = frames[0].height
    yy, xx = np.mgrid[:cell, :cell].astype(np.float32)

    def band(low, high, value):
        t = np.clip((value / cell - low) / (high - low), 0, 1)
        return t * t * (3 - 2 * t)

    result = []
    for index, frame in enumerate(frames):
        phase = 2 * np.pi * index / len(frames)
        # A gentle second harmonic makes expansion and release asymmetric;
        # both terms have the loop's exact period. Head follows torso by 1/8.
        def wave(p):
            return (np.sin(p) + 0.15 * np.sin(2 * p)) / 1.15
        source_y = yy.copy()
        for _ in range(5):
            head = band(.08, .16, source_y) * (1 - band(.40, .56, source_y))
            torso = band(.38, .53, source_y) * (1 - band(.70, .81, source_y))
            source_y = yy - cell * amplitude * (
                wave(phase) * torso + .55 * wave(phase - np.pi / 4) * head)
        data = np.asarray(frame).astype(np.float32) / 255
        data[:, :, :3] *= data[:, :, 3:4]
        data = cv2.remap(data, xx, source_y.astype(np.float32), cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_CONSTANT)
        alpha = data[:, :, 3:4]
        data[:, :, :3] = np.divide(data[:, :, :3], alpha,
                                   out=np.zeros_like(data[:, :, :3]), where=alpha > .001)
        result.append(Image.fromarray(np.uint8(np.clip(data * 255, 0, 255))))
    return result


def validate_budget(sequence, budgets, count, loop=True):
    if len(budgets) != len(sequence) - 1 or any(n <= 0 for n in budgets):
        raise ValueError('Every pose segment needs a positive frame budget')
    if sum(budgets) != count - (0 if loop else 1):
        raise ValueError(f'Frame budget {budgets} does not fill {count} frames')


def preview(groups, rates, path, loop=True):
    """Review decoded assets at their real rates on both application themes.

The preview spans the least common period. A shared frame index would falsely
show the calm animation running as fast as the alarm.
"""
    count = len(groups[0])
    tick_rate = lcm(*rates)
    periods = [count * tick_rate // rate for rate in rates]
    duration = lcm(*periods) if loop else periods[0]
    stride = gcd(*(tick_rate // rate for rate in rates))
    cell = 256
    small = [[f.resize((cell, cell), Image.Resampling.LANCZOS) for f in frames]
             for frames in groups]
    previews, durations = [], []
    for tick in range(0, duration, stride):
        canvas = Image.new('RGB', (cell * len(groups), cell * 2), '#FAF9F6')
        canvas.paste('#14213A', (0, cell, canvas.width, cell * 2))
        for col, (frames, rate) in enumerate(zip(small, rates)):
            index = (tick * rate // tick_rate) % count
            frame = frames[index]
            canvas.paste(frame, (col * cell, 0), frame)
            canvas.paste(frame, (col * cell, cell), frame)
        previews.append(canvas)
        durations.append(round((tick + stride) * 1000 / tick_rate) - round(tick * 1000 / tick_rate))
    previews[0].save(path, save_all=True, append_images=previews[1:],
                     duration=durations, loop=0 if loop else 1, quality=90, method=3)

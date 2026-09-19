"""Read a chroma-green keyframe sheet and hand back aligned, cropped poses.

The sheets are generated art, not renders from a rig, so the "fixed camera" the
pipeline needs is approximate at best: measured across the four sheets the feet
wander up to 53px between cells and the torso width up to 13% within one sheet.
Cropping on the nominal cell grid would ship that drift as a jump every time the
animation reaches a new pose, which is exactly the artefact the fixed crop
anchor in `prepare-expiry-escalation.py` exists to prevent. One sheet is worse
than drift: two `greeting` poses run into each other across the nominal
boundary, so a grid crop would put a slice of one character inside the next
one's cell.

So the anchor is measured rather than assumed. Each pose is found by the empty
columns around it, then cropped into a window of one size per sheet, centred on
the feet with the feet at a fixed height. The feet are the right anchor because
they are the one part of this character that does not move: he crouches, leans
and swings his arms, but he never leaves the ground. Anchoring on the whole
silhouette would pull the body sideways whenever an arm extended, which is the
failure the fixed grid was guarding against in the first place.

One window size per sheet, never per pose. Normalising each pose to its own
size would cancel the crouch in `success` and the lean in `scan` — the very
motion the sequences are built out of.
"""
import cv2
import numpy as np
from PIL import Image, ImageFilter


#: Torso width, in points of a 256px cell, that these four atlases ship at
#: today: measured 215, 211, 216 and 211 on the four built from
#: `mascot-atlas.png`. Holding it keeps the character exactly the size he is
#: now, so this change alters how he moves and nothing else. (The escalation
#: trio sits nearer 190 and six-seven nearer 165; that disagreement already
#: ships and is not this task's to settle.)
TORSO_AT_256 = 213

#: Radius the torso is eroded by, in points of a 256px cell. Big enough to take
#: the arms, legs and magnifier off, small enough to leave the body.
ERODE_AT_256 = 23

#: Where the feet sit in the cropped cell, matching the existing 512px sheets
#: (feet at y 454-469 of 512).
FEET_FRACTION = 0.92

#: A column with fewer occupied pixels than this counts as background. Small
#: enough to catch a magnifier handle, large enough to ignore keyer speckle.
MIN_COLUMN = 3

#: Narrower than this and a span is a keying artefact, not a character.
MIN_POSE_WIDTH = 60


def cutout(path):
    """Key the chroma green, using the escalation sheet's keyer exactly.

    The spill suppression and the one-pixel alpha erosion are not optional:
    green left at the silhouette becomes a halo on the app's dark theme.
    """
    with Image.open(path) as source:
        rgb = np.asarray(source.convert('RGB')).astype(np.float32)
    excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    alpha = 1 - np.clip(excess / 80, 0, 1)
    rgb[:, :, 1] = np.minimum(rgb[:, :, 1], np.maximum(rgb[:, :, 0], rgb[:, :, 2]))
    keyed = Image.fromarray(np.uint8(np.dstack((rgb, alpha * 255))))
    keyed.putalpha(keyed.getchannel('A').filter(ImageFilter.MinFilter(3)))
    return keyed


def _spans(occupied):
    """Column runs that hold a character, in order."""
    runs, start = [], None
    for x, filled in enumerate(occupied):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(occupied)))
    return [run for run in runs if run[1] - run[0] >= MIN_POSE_WIDTH]


def _torso(alpha, radius):
    """Width of the body with the arms, magnifier and legs eroded away.

    A plain bounding box measures whichever limb is furthest out, which is a
    property of the pose rather than of the camera. The torso is what has to
    stay the same size between poses, so the torso is what gets measured.

    The radius has to travel with the scale being measured at. An erosion that
    strips the arms off a 256px cell leaves most of them on a 512px one, so a
    source measured at one radius and an atlas checked at another disagree by
    about 30% — which is how the first build of these sheets came out that much
    oversized.
    """
    eroded = cv2.erode((alpha > 8).astype(np.uint8), np.ones((radius, radius), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(eroded)
    if count < 2:
        return None
    largest = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
    return stats[largest, cv2.CC_STAT_WIDTH] + radius - 1


def _anchor(alpha, x0, x1):
    """Where this pose stands: the centre of its feet, and the ground line."""
    window = alpha[:, x0:x1]
    rows, _ = np.nonzero(window > 8)
    ground = rows.max() + 1
    _, feet_x = np.nonzero(window[ground - 40:ground, :] > 8)
    return x0 + feet_x.mean(), ground


def _crop(keyed, pose, window, cell):
    """One pose, cut to `window` square on its own feet and resized to `cell`.

    `Image.crop` pads past the sheet's edges with transparency, which is what a
    pose standing near the border needs.
    """
    left = int(round(pose['centre'] - window / 2))
    top = int(round(pose['ground'] + window * (1 - FEET_FRACTION) - window))
    cropped = keyed.crop((left, top, left + window, top + window))
    return cropped.resize((cell, cell), Image.Resampling.LANCZOS)


def load_sheet(path, cell, expected=None):
    """Every pose on the sheet, keyed, aligned and resized to `cell` square.

    Poses come back in reading order: the top row left to right, then the row
    below it. Empty cells contribute nothing, so a three-pose sheet returns
    three poses rather than three poses and a hole.
    """
    keyed = cutout(path)
    alpha = np.asarray(keyed)[:, :, 3]
    height, width = alpha.shape
    band_height = height // 2

    found = []
    for band in range(2):
        top, bottom = band * band_height, (band + 1) * band_height
        strip = alpha[top:bottom, :]
        occupied = (strip > 8).sum(axis=0) >= MIN_COLUMN
        for x0, x1 in _spans(occupied):
            centre, ground = _anchor(strip, x0, x1)
            found.append({
                'centre': centre,
                'ground': top + ground,
                'bbox': x1 - x0,
                'span': (x0, x1),
            })

    if expected is not None and len(found) != expected:
        raise ValueError(f'{path}: found {len(found)} poses, expected {expected}')

    # One window for the whole sheet. The median torso is the sheet's scale;
    # using each pose's own would flatten the crouches and leans back out.
    #
    # Solved rather than computed in one step, because the window size and the
    # torso measurement each depend on the other: the erosion radius that
    # isolates a torso is defined at the output scale, and the output scale is
    # what the window decides. Measuring the source at one radius and the atlas
    # at another is how the first build of these sheets came out 29% oversized.
    # A damped fixed point from a rough guess, because the undamped one
    # oscillates: a window small enough to clip the character reads its torso
    # as the whole cell, which throws the next guess as far the other way.
    # Pulling only part of the way each pass converges in about eight.
    target = TORSO_AT_256 * cell / 256
    radius = max(3, int(round(ERODE_AT_256 * cell / 256)))
    window = int(round(float(np.median([pose['bbox'] for pose in found])) * 1.15))
    for _ in range(12):
        measured = float(np.median([
            _torso(np.asarray(_crop(keyed, pose, window, cell))[:, :, 3], radius)
            for pose in found]))
        # Too big on screen means the window was too tight: widen it.
        window = max(cell // 4, int(round(window * (measured / target) ** 0.6)))

    poses = [_crop(keyed, pose, window, cell) for pose in found]
    torso = float(np.median([
        _torso(np.asarray(pose)[:, :, 3], radius) for pose in poses]))
    return poses, {'window': window, 'torso': torso, 'poses': found}

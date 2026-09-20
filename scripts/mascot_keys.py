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

#: How much wider than the torso the whole character is allowed to be before a
#: sheet is unusable.
#:
#: This is the number the first four sheets failed on, and it is the one that
#: decides whether a square cell can hold the body at full size and the
#: magnifier at once. The approved poses sit at 1.03-1.06 — the magnifier is
#: held in close — and the rejected sheets at 1.84-2.02, with the arm at full
#: reach. Past roughly 1.4 there is no framing that keeps the character the
#: size he ships at without cutting the magnifier off at the cell edge, and the
#: magnifier travels so far between poses that optical flow renders two of
#: them. The gate sits well clear of both groups so it never has to be argued
#: about.
MAX_SILHOUETTE_RATIO = 1.4


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


def _reach(occupied, x0, x1):
    """The pose's true left and right edges, past the span that found it.

    `_spans` calls a column background below `MIN_COLUMN` pixels, which is the
    right rule for telling two poses apart and the wrong one for framing: a
    magnifier handle three pixels wide is not background, and a crop sized to
    the span alone cuts it off. So the span is grown outward while there is
    anything at all in the column, stopping at the first empty one — which is
    the same gap `_spans` used to separate this pose from its neighbour, so
    growing can never run into the pose next door.
    """
    any_pixel = occupied > 0
    left, right = x0, x1
    while left > 0 and any_pixel[left - 1]:
        left -= 1
    while right < len(any_pixel) and any_pixel[right]:
        right += 1
    return left, right


def _anchor(alpha, x0, x1):
    """Where this pose stands: the centre of its feet, the ground line, and the
    highest pixel it reaches."""
    window = alpha[:, x0:x1]
    rows, _ = np.nonzero(window > 8)
    ground = rows.max() + 1
    _, feet_x = np.nonzero(window[ground - 40:ground, :] > 8)
    return x0 + feet_x.mean(), ground, rows.min()


def _crop(keyed, pose, window, cell):
    """One pose, cut to `window` square on its own feet and resized to `cell`.

    `Image.crop` pads past the sheet's edges with transparency, which is what a
    pose standing near the border needs.

    The window reaches past the pose on every side by whatever the sheet's scale
    demands, which on a tightly packed sheet is far enough to catch the pose
    next door. So the crop is masked to the band and the span the pose was
    found in: a pose lies entirely inside both, which makes the mask free of
    risk to the pose itself and fatal only to a neighbour leaking in.

    Both axes, because both happen. Vertically the `concern` sheet puts a
    five-pixel sliver of the second row's head along the bottom edge of the
    first row's first cell. Horizontally it is worse: a window wide enough for
    an extended arm — `scan` wants 580 points where the poses sit 512 apart —
    pulls fifty-odd columns of the previous pose into the cell, and optical
    flow then spends the whole cycle fading a second character in and out.
    """
    left = int(round(pose['centre'] - window / 2))
    top = int(round(pose['ground'] + window * (1 - FEET_FRACTION) - window))
    cropped = keyed.crop((left, top, left + window, top + window))
    alpha = np.asarray(cropped.getchannel('A')).copy()
    touched = False
    for axis, (lo, hi), origin in ((0, pose['band'], top), (1, pose['span'], left)):
        near, far = lo - origin, hi - origin
        if near <= 0 and far >= window:
            continue
        touched = True
        head = (slice(None, max(0, near)),) if axis == 0 else (slice(None), slice(None, max(0, near)))
        tail = (slice(max(0, min(window, far)), None),) if axis == 0 else (slice(None), slice(max(0, min(window, far)), None))
        alpha[head] = 0
        alpha[tail] = 0
    if touched:
        cropped.putalpha(Image.fromarray(alpha))
    return cropped.resize((cell, cell), Image.Resampling.LANCZOS)


def sheet_ratio(path):
    """How much wider than his torso the character is on this sheet.

    Returned rather than asserted so the caller can fall back to older artwork
    instead of failing the build: sheets land one at a time, and a state whose
    replacement is not ready yet should keep the atlas it already has.

    A file that will not decode gets the same answer as a file that is not
    there, for the same reason. Two sheets arrived truncated at exactly 768 KiB
    — good artwork, half a PNG — and a build that dies on them is a build that
    cannot produce the other six atlases either. Infinity routes this state to
    its fallback and leaves the rest of the run alone; the caller prints why.
    """
    try:
        keyed = cutout(path)
    except (OSError, ValueError, SyntaxError):
        return float('inf')
    alpha = np.asarray(keyed)[:, :, 3]
    band_height = alpha.shape[0] // 2
    ratios = []
    for band in range(2):
        strip = alpha[band * band_height:(band + 1) * band_height, :]
        occupied = (strip > 8).sum(axis=0) >= MIN_COLUMN
        for x0, x1 in _spans(occupied):
            pose = strip[:, x0:x1]
            rows, cols = np.nonzero(pose > 8)
            silhouette = max(cols.max() - cols.min() + 1, rows.max() - rows.min() + 1)
            torso = _torso(pose, 45)
            if torso:
                ratios.append(silhouette / torso)
    return float(np.median(ratios)) if ratios else float('inf')


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
        column = (strip > 8).sum(axis=0)
        occupied = column >= MIN_COLUMN
        for x0, x1 in _spans(occupied):
            centre, ground, highest = _anchor(strip, x0, x1)
            found.append({
                'centre': centre,
                'ground': top + ground,
                'top': top + highest,
                'band': (top, bottom),
                'bbox': x1 - x0,
                # Framing has to use the true edges, not the ones that told
                # this pose apart from the next. See `_reach`.
                'span': _reach(column, x0, x1),
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

    # The torso sets the scale, but the furthest-reaching pose sets the floor: a
    # cheer that reaches higher than the others would have its raised arms cut
    # off at the top of the cell, which is the one thing worse than a slightly
    # small character. Whichever is larger wins, so the size follows the artwork
    # rather than a constant, and no sheet can clip whatever its poses do.
    #
    # Both directions, because they fail differently and a sheet can fail
    # either. Height is what the two accepted sheets are bound by — the
    # magnifier held above the head. Width is what the two rejected ones would
    # be: `scan` needs 580 points across and a torso-sized window gives it 421,
    # so before this it silently cropped 159 points of arm away rather than
    # reporting a sheet it could not frame. Silent clipping is the worst of the
    # three outcomes; shrinking is visible, and `MAX_SILHOUETTE_RATIO` is what
    # stops a sheet that would shrink too far from being used at all.
    #
    # Sideways is measured from the crop's own centre rather than as a plain
    # bounding box, because the crop centres on the feet: an arm out to one
    # side needs half the window on that side alone, which is the whole
    # difference between 1.53x the torso and 1.15x.
    #
    # The 2% is not slack for its own sake: sizing the window to exactly the
    # measured reach leaves the outermost pixel on the cell's edge, and the
    # Lanczos resize to the atlas cell then spreads it over the boundary. Two
    # percent is about four points at this scale — invisible, and enough.
    tall = max((pose['ground'] - pose['top']) for pose in found) * 1.02
    wide = max(max(pose['centre'] - pose['span'][0],
                   pose['span'][1] - pose['centre']) for pose in found) * 2 * 1.02
    window = max(window, int(np.ceil(tall / FEET_FRACTION)), int(np.ceil(wide)))

    poses = [_crop(keyed, pose, window, cell) for pose in found]
    torso = float(np.median([
        _torso(np.asarray(pose)[:, :, 3], radius) for pose in poses]))
    return poses, {'window': window, 'torso': torso, 'poses': found}

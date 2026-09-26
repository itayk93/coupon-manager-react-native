"""Rig layouts for every Kuponi state.

Coordinates are canonical space: the pixel grid of
`assets/mascot/original_app_mascot.png`. Every state stands on the same
canonical body at the same place, with the face features where the approved
scan rig puts them, so switching state never moves or resizes him.

`width` is the width of a part's visible artwork in canonical pixels. That is
the one uniform scale factor the part gets. Hands and props are placed by
`anchor`: the source pixel `pivot_src` (the wrist or shoulder stub from the kit
manifest) lands on that canonical point, and the part turns about it.
"""
from __future__ import annotations

import copy

WINDOW = {"x": 195, "y": -95, "size": 1100}
FEET = [707, 910]

BODY = {"name": "body", "file": "scan/canonical-body.png", "width": 671, "centre": [707, 500]}

EYES = [
    {"name": "eye-left", "file": "scan/eye-white-left.png", "width": 148, "centre": [722, 452]},
    {"name": "eye-right", "file": "scan/eye-white-right.png", "width": 122, "centre": [932, 393]},
]


def pupils(file="scan/pupil.png", left=72, right=60, look=(0, 0)):
    dx, dy = look
    return [
        {"name": "pupil-left", "file": file, "width": left, "centre": [760 + dx, 469 + dy], "clip": "eye-left"},
        {"name": "pupil-right", "file": file, "width": right, "centre": [951 + dx, 410 + dy], "clip": "eye-right"},
    ]


LIDS = [
    {"name": "lid-half-left", "file": "scan/eyelid-half-left.png", "width": 163, "centre": [722, 408], "clip": "eye-left"},
    {"name": "lid-half-right", "file": "scan/eyelid-half-right.png", "width": 134, "centre": [932, 352], "clip": "eye-right"},
    {"name": "lid-closed-left", "file": "scan/eyelid-closed-left.png", "width": 163, "centre": [722, 452], "clip": "eye-left"},
    {"name": "lid-closed-right", "file": "scan/eyelid-closed-right.png", "width": 134, "centre": [932, 393], "clip": "eye-right"},
]
LID_NAMES = {entry["name"] for entry in LIDS}


def brows(left_file, right_file, left_width=74, right_width=66, lift=0, suffix=""):
    return [
        {"name": f"brow-left{suffix}", "file": left_file, "width": left_width, "centre": [689, 330 - lift]},
        {"name": f"brow-right{suffix}", "file": right_file, "width": right_width, "centre": [918, 268 - lift]},
    ]


NEUTRAL_BROWS = ("scan/brow-neutral-left.png", "scan/brow-neutral-right.png")
MOUTH_AT = [835, 532]


def mouth(file, width, name="mouth", dy=0):
    return {"name": name, "file": file, "width": width, "centre": [MOUTH_AT[0], MOUTH_AT[1] + dy]}


# Resting arms, shared by several states.
HAND_LEFT_RELAXED = {"name": "hand-left", "file": "scan/hand-left-relaxed.png", "width": 150,
                     "centre": [425, 668], "pivot": [410, 572]}
HAND_RIGHT_RELAXED = {"name": "hand-right", "file": "shared/hand-right-relaxed.png", "width": 136,
                      "pivot_src": [440, 483], "anchor": [1000, 585]}

# One straight arm that turns about the shoulder: raised in alarm, and in
# `relieved` the same piece comes down to hang at his side. The kit draws it at
# the scale of canonical-body.png, 780 px of torso to our 671.
ARM_SWING = {"name": "arm", "file": "alarmed/arm-left-swing.png", "width": 143 * 671 / 780,
             "pivot_src": [628, 852], "anchor": [403, 543], "angle": -15}

FACE_LAYERS = {"eye-left", "eye-right", "pupil-left", "pupil-right", *LID_NAMES}


def spec(*layers, window=WINDOW):
    return {"window": dict(window), "feet": list(FEET), "layers": copy.deepcopy([BODY, *layers])}


SPECS = {
    "greeting": spec(
        *EYES, *pupils(look=(-6, -2)), *LIDS,
        *brows(*NEUTRAL_BROWS), *brows("scan/brow-raised-left.png", "scan/brow-raised-right.png", 53, 69, 12, "-raised"),
        mouth("scan/mouth-smile-small.png", 82, "mouth-smile"),
        mouth("greeting/mouth-talk-a.png", 62, "mouth-a", 6),
        mouth("greeting/mouth-talk-o.png", 44, "mouth-o", 8),
        mouth("greeting/mouth-talk-e.png", 88, "mouth-e", 10),
        {"name": "hand-wave", "file": "greeting/hand-wave-open.png", "width": 175,
         "pivot_src": [706, 905], "anchor": [440, 600], "angle": -5},
        {"name": "magnifier", "file": "shared/magnifier-lowered.png", "width": 330,
         "pivot_src": [325, 465], "anchor": [975, 600], "angle": 22},
    ),
    "success": spec(
        {"name": "eyes-happy-left", "file": "success/eye-happy-closed-left.png", "width": 118, "centre": [722, 452]},
        {"name": "eyes-happy-right", "file": "success/eye-happy-closed-right.png", "width": 104, "centre": [930, 398]},
        *brows("success/brow-happy-left.png", "success/brow-happy-right.png", 80, 72, 14),
        mouth("success/mouth-big-laugh.png", 104, dy=18),
        {"name": "hand-fist", "file": "success/hand-fist-up.png", "width": 165,
         "pivot_src": [717, 860], "anchor": [440, 610], "angle": -3},
        {"name": "magnifier", "file": "shared/magnifier-raised.png", "width": 235,
         "pivot_src": [520, 830], "anchor": [1005, 600]},
    ),
    "concern": spec(
        *EYES, *pupils(look=(-4, 0)), *LIDS,
        *brows("shared/brow-worried-left.png", "shared/brow-worried-right.png", 76, 70, 4),
        mouth("concern/mouth-frown.png", 78, dy=6),
        # The chest fist's short wrist stub stood out of the body edge like a cut-off
        # arm; the whole resting arm from the shoulder reads as a hand, not a stump.
        HAND_LEFT_RELAXED,
        {"name": "magnifier", "file": "shared/magnifier-raised.png", "width": 235,
         "pivot_src": [520, 830], "anchor": [1005, 600]},
    ),
    "worried": spec(
        *EYES, *pupils("shared/pupil-small.png", 58, 48), *LIDS,
        *brows("shared/brow-worried-left.png", "shared/brow-worried-right.png", 76, 70, 4),
        mouth("worried/mouth-worried-wavy.png", 82, dy=6),
        # The chest fist's short wrist stub stood out of the body edge like a cut-off
        # arm; the whole resting arm from the shoulder reads as a hand, not a stump.
        HAND_LEFT_RELAXED,
        {"name": "magnifier", "file": "scan/magnifier-front.png", "width": 555, "centre": [913, 573],
         "pivot": [749, 684]},
    ),
    "alarmed": spec(
        *EYES, *pupils("shared/pupil-small.png", 58, 48), *LIDS,
        *brows("alarmed/brow-alarmed-left.png", "alarmed/brow-alarmed-right.png", 80, 70, 22),
        mouth("alarmed/mouth-alarmed-open.png", 40, dy=12),
        ARM_SWING,
        {"name": "magnifier", "file": "alarmed/magnifier-front-tilted.png", "width": 400,
         "pivot_src": [345, 830], "anchor": [820, 700]},
    ),
    "six-seven": spec(
        *EYES, *pupils(look=(10, 0)), *LIDS,
        {"name": "brow-left", "file": NEUTRAL_BROWS[0], "width": 74, "centre": [689, 336]},
        {"name": "brow-right", "file": "six-seven/brow-cocky-right.png", "width": 76, "centre": [918, 252]},
        mouth("six-seven/mouth-smirk.png", 84, dy=2),
        {"name": "palm-left", "file": "six-seven/hand-palm-up-left.png", "width": 300,
         "pivot_src": [938, 596], "anchor": [420, 640], "angle": 14},
        {"name": "palm-right", "file": "six-seven/hand-palm-up-right.png", "width": 300,
         "pivot_src": [327, 616], "anchor": [1015, 610], "angle": -14},
        window={"x": 50, "y": -135, "size": 1320},
    ),
}

# Relieved starts as alarmed and settles as calm, so it carries both sets of
# face parts and swaps them while his eyes are shut.
SPECS["relieved"] = spec(
    *EYES, *pupils("shared/pupil-small.png", 58, 48, ), *pupils(),
    *LIDS,
    *brows("alarmed/brow-alarmed-left.png", "alarmed/brow-alarmed-right.png", 80, 70, 22, "-alarmed"),
    *brows(*NEUTRAL_BROWS),
    mouth("alarmed/mouth-alarmed-open.png", 40, "mouth-alarmed", 12),
    mouth("relieved/mouth-relieved-exhale.png", 50, "mouth-exhale", 10),
    mouth("scan/mouth-smile-small.png", 82, "mouth-smile"),
    ARM_SWING,
    {"name": "magnifier", "file": "alarmed/magnifier-front-tilted.png", "width": 400,
     "pivot_src": [345, 830], "anchor": [820, 700]},
)
# Two pupil sets share names above; give the calm pair their own.
_relieved = SPECS["relieved"]["layers"]
for entry in _relieved:
    if entry["name"].startswith("pupil") and entry["file"] == "scan/pupil.png":
        entry["name"] += "-calm"

# 3D mascot animation assets

Status: integrated. Eight `*-smooth.webp` (lossless) production atlases: the four
originals below, the 6-7 egg, and `worried` / `alarmed` / `relieved`, added later
from two chroma-green keyframe sheets by `scripts/prepare-expiry-escalation.py`.
`relieved` is the only one that is not a loop — it plays once and holds its last
frame. Each atlas contains
36 transparent 256px frames in a 6x6 grid. Playback is state-specific: scan/calm 12fps (3s), concern 16fps (2.25s),
worried 18fps (2s), and talking/cheering/alarmed/six-seven 24fps (1.5s).
Relieved remains a forward one-shot at 24fps.
`preview-smooth.webp` previews all actions on light and dark backgrounds.
`mascot-atlas.png` preserves the approved original keyframes for regeneration.
The opaque source draft and old preview are not referenced by the application.

Reference: user-provided `original_app_mascot.png`.
Generated using the built-in image generation tool on 2026-09-10.

## Every state is a rigid rig now (2026-09-25)

All eight `*-smooth.webp` atlases are built by `scripts/mascot_rig/build.py`
from separate generated layers in `rig/`. The optical-flow interpolation,
the breathing field and the six-seven deformation field described further
down warped the body between separately drawn keyframes, so on screen he
stretched and shrank like dough. Those sections are history; the scripts that
implement them no longer write production atlases.

- `rig/scan/`: the first kit (body, eye whites, pupil, lids, brows, smile,
  resting arm, hand-and-magnifier) and `rig.json`, its placement.
- `rig/shared/`, `rig/<state>/`: the second kit, imported and cleaned by
  `scripts/mascot_rig/prepare_parts.py` (stray specks dropped; magnifier
  lenses remapped into 55-75% opacity; no pixel moved or rescaled). Its own
  notes are kept as `rig/states-READ-ME.txt`, `states-manifest.json` and
  `states-PROMPTS.md`. That kit was delivered as a draft: parts at mixed
  scales, pivots estimated, and full-character references that redrew the
  body. The references were not imported and nothing was matched to them.
- `scripts/mascot_rig/states.py`: where each part of each state sits.
  Coordinates are the pixel grid of `original_app_mascot.png`. Every state
  stands on the one `rig/scan/canonical-body.png`, with its face parts
  where scan puts them. Each part gets one uniform scale, chosen by eye
  against the body; hands are placed by their wrist or shoulder stub.

Two later fixes. `rig/alarmed/arm-left-swing.png` (a straight arm drawn at
the scale of `canonical-body.png`, so it is scaled by exactly 671/780) replaces
the raised hand in `alarmed` and `relieved`: it turns about the shoulder, so in
`relieved` the same piece swings down across his front and ends hanging at his
side, where the old hand still read as a wave. It swings inward because the arm
is longer than the room to the left of the body. `concern` and `worried` use
scan's full resting arm instead of the chest fist, whose short wrist stub stood
out of the body edge like a cut-off arm and crowded the magnifier hand. A
hip-clutch hand was generated for `worried` but read as a thumbs-up, so it is
not used.

Each layer is scaled once, uniformly. A frame can only translate a layer,
turn it about its pivot, or swap it for another whole part (a mouth shape on
a talking beat, an expression while the eyes are shut). The builder refuses
to write an atlas if the body's area or principal axes change by 0.2% in any
frame, if a loop's 35 -> 0 step is larger than its largest ordinary step, or
if any frame comes within 3% of its cell edge.

Cells are 320px, 36 frames in a 6x6 grid. Every state except six-seven uses
the same 1100-point window, so switching state never resizes him; six-seven
uses 1320 points to fit both outstretched arms. Rates: scan/calm 18fps,
concern 16fps, worried 18fps, the rest 24fps. `relieved` plays once and holds
its last frame.

    python3 scripts/mascot_rig/build.py --preview /tmp/kuponi-review

## New keyframe sheets: two of four earned the swap

All four replacement sheets are in `source/` and all four now decode. Two are
in use and two are not, and the reason is not that the other two failed a
check — they passed the framing gate. They are simply worse artwork for their
states, measured against the approved 320px rows they would replace:

| state | retrace, 320px -> sheet | torso, 320px -> sheet | in use |
| --- | --- | --- | --- |
| `success` | 0.42 -> 1.31 | — -> 196 | the sheet |
| `concern` | 2.09 -> 2.25 | 206 -> 190 | the sheet |
| `scan` | 2.25 -> 1.23 | 216 -> 174 | the 320px row |
| `greeting` | 1.92 -> 1.46 | 210 -> 191 | the 320px row |

"Retrace" is how far each frame is from the nearest frame that is not its own
neighbour, in units of one frame-to-frame step. Low means the loop passes close
to itself — the out-and-back this whole effort exists to remove. `success` at
0.42 had frames that were bit-identical to each other.

`success` is the reason any of this happened: the approved art gave it only two
poses that shared an expression, so it could not cycle at all. `concern` gained
a fourth pose. `scan` and `greeting` gained nothing — their 320px rows already
cycled, and the sheets are worse on both numbers.

They are also worse in the way that does not reduce to a number, which is the
part worth remembering. The brief for these sheets asked for the hands close to
the body and pose variety from the torso leaning rather than the arms reaching
out. That is exactly right for a character holding a magnifier, and it is wrong
for a wave: the new `greeting` poses hold a closed fist at the side, so the
greeting state no longer greets. The new `scan` moves the magnifier off the
face to beside the head, so he reads as holding one rather than looking through
it. A constraint written for one gesture was applied to all four.

`USE_SHEET` in `scripts/interpolate-mascot-3d.py` records the choice per state.
The ratio gate still runs on top of it, so a sheet that is later re-uploaded
broken or reframed badly falls back on its own rather than shipping a
regression.

### What the gate measures, and what it cannot

`MAX_SILHOUETTE_RATIO` (1.4) is how much wider the whole silhouette may be than
the torso. It governs whether a square cell can hold both the body at full size
and the magnifier, and whether optical flow can follow the magnifier between
poses instead of rendering two of them. The approved art sits at 1.03-1.06, the
accepted sheets at 1.14-1.15, and the two unused ones at 1.32-1.33 — inside the
gate, which is why the gate alone does not decide.

A file that will not decode gets the same answer as a file that is not there.
Two sheets first arrived truncated at exactly 786,444 bytes — 768 KiB plus
twelve, no IEND, deflate broken mid-chunk — and one unreadable sheet must not
stop the other seven atlases from building.

### Framing

`scripts/mascot_keys.py` keys the green, finds each pose by the empty columns
around it, and crops on the feet rather than the nominal grid, which these
sheets need: they drift up to 53px vertically between cells, and two `greeting`
poses cross a cell boundary into each other.

Three rules the sheets taught it:

**The window follows the artwork in both directions.** It is solved against a
torso measured at the output scale, then widened if any pose reaches further
than that allows — up, down or sideways. Before the sideways half existed,
`scan` needed 580 points across, got 421, and lost 159 points of arm silently.
Silent clipping is the worst outcome available; shrinking is at least visible.

**Every crop is masked to its own band and span.** A window wide enough for an
extended arm is wider than the 512 points between poses, so it reaches into the
pose next door — fifty-odd columns of another character, which optical flow
would fade in and out for the whole cycle.

**The window centres on the sheet's envelope, not on the feet.** The feet are
the right anchor vertically, and the wrong one horizontally the moment a pose
holds the magnifier out to one side: a feet-centred crop must be wide enough
for the furthest reach on *both* sides. `greeting`'s widest pose occupies 410
points and demanded 548, and the character shrank by the difference — 129px of
torso where the same sheet framed on its envelope gives 191. The shift is one
number for the whole sheet, never per pose, so nothing slides between frames.

## Character invariants

Cobalt-blue rounded square body, large white eyes with dark pupils and white
highlights, dark curved eyebrows, small smile, short rounded blue legs and hands,
graphite magnifying glass with a blue-tinted lens. Preserve the reference's soft
3D material. No hat, antenna, clothing, or mint recoloring.

## Draft animation strips

The generated image contains four rows, each with four poses:

1. Scanning: loading, parsing, thinking, calm.
2. Greeting: onboarding, invitations, sharing.
3. Celebration: success, coupon usage, sale, savings.
4. Concern: expiry reminders.

The locally prepared atlas has real alpha and individually aligned frame bounds.
On 2026-09-11, bidirectional optical-flow interpolation generated intermediate
frames from the approved artwork. Premultiplied-alpha warping preserves clean
edges. No new character design or AI redraw was introduced in this smoothing pass.
Greeting uses the three open-mouth poses; celebration uses the two closed-eye
poses to avoid double eyes during interpolation. Concern omits the fourth pose.
All cycles have 36 frames and omit the duplicate closing pose. The player supplies
that pose on wrap. In the first motion-only revision, scan follows `[0,1,2,3,0]`
with budgets `[8,7,6,15]`; greeting `[1,2,3,1]` with `[13,11,12]`; concern
`[0,1,2,0]` with `[9,11,16]`; worried/alarmed `[0,1,2,0]` with `[9,11,16]`.
Concern's fourth original pose changes grip and mouth shape, so it is excluded.
Success and concern have since moved to their own keyframe sheets and to
four-pose cycles: `[0,1,2,3,0]` with `[7,8,8,13]` and `[7,7,8,14]`. Success was
the one state the approved art could not cycle at all — only two of its four
poses shared an expression, so `[0,1,0]` with `[12,24]` went out to one pose and
came back the same way, the bounce this whole upgrade exists to remove. Concern
could cycle on three poses but passed close to itself doing it; the fourth pose
opens the loop out. Scan and greeting still run the budgets above from the
approved keys.
The mirrored return was dropped because replaying every gesture backwards reads
as a rewind. Smoothstep and a single warped source avoid translucent second arms.
A premultiplied periodic breathing field offsets head and torso by one eighth of
a cycle and leaves the feet anchored. No breathing is added to alarm or relief. These are rendered
3D-style animations, not rigged 3D models.

## Integration targets

- `CharacterScene`: onboarding.
- `CharacterSpotlight`: all direct uses plus `MascotLoadingState` and `EmptyState`.
- `FloatingMascot`: notifications, retaining drag behavior.
- `MascotSprite`: sharing empty state.
- Both `targets/add-share` and `targets/share`: native iOS share extensions.

Widget artwork is unchanged by this replacement. React playback stops when the
screen loses focus, the application backgrounds, or Reduce Motion is enabled.
Both iOS extensions use the scan/success atlases with native image animation and respond
to Reduce Motion changes. Their animations stop when dismissed.

## Generation prompt

Create a production animation sprite sheet for a React Native app. Preserve the
reference mascot with maximum fidelity: cobalt rounded square body, white oval
eyes, navy pupils with white highlights, dark eyebrows, tiny smile, blue rounded
legs and mitten hands, graphite magnifying glass with blue tinted lens. Same soft
3D material and proportions. No redesign. Request a square transparent PNG,
four columns by four rows, full body at fixed scale and camera with safe margins.
Rows: scanning, welcoming wave, celebration, concerned reminder. Subtle poses progressing around a complete cycle, with a distinct settling
route back to the opening pose. Keep eyes and mouth topology and hand grip stable. No labels or backdrop.

The follow-up asked to remove the baked-in checkerboard and preserve every pose;
it also returned an opaque image. The user explicitly approved local processing.
`scripts/prepare-mascot-3d.py` removes border-connected neutral background,
preserves enclosed facial highlights, cleans edges, aligns crops, and generates
the original keyframe atlas and preview. Run `scripts/interpolate-mascot-3d.py`
afterward to generate the smooth atlases, intermediate-frame proof, animated
preview, and native copies. Requires Pillow, numpy and opencv-python.

React uses elapsed-time playback rather than counting delayed timer callbacks.
It displays a static first frame until the selected atlas loads. Only the
current action atlas is displayed; no per-frame image downloads are needed.

## Six–seven Easter egg

`six-seven-smooth.webp` is a separate 36-frame, 24fps loop. The dashboard shows
it at exactly 67 spendable coupons, independently of search/filter selection.
The dismissible banner does not replace the normal loading/success animations.

Reference motion: https://cmsmedia.org/1457/news/the-6-7-meme/ — open palms
alternately rise and fall like balancing scales. On 2026-09-11 the image tool
generated six fixed-camera poses from the user's supplied blue mascot artwork.
Prompt constraints: three columns by two rows, frontal body, palms up, opposing
arm movement, cheeky half-lidded smile, unchanged blue material/proportions,
no magnifier, no text, chroma-green background.

`scripts/prepare-six-seven.py` removes green and animates the neutral generated
pose with a continuous opposing-arm deformation field. These intermediate
frames are locally rendered, not separately AI-generated poses or a rigged 3D
model. This avoids the doubled fingers produced by optical-flow interpolation.
Source: `source/six-seven-keyframes.png`; preview: `six-seven-preview.webp`.

The widget uses the user's exact `ChatGPT Image Sep 11, 2026, 06_55_56 PM.png`
as `../celebration/C10-six-seven.png` and the iOS image-set copy. Android uses
a resized WebP. The static widget headline is `67 קופונים!`, below the logo.
The milestone is remembered once, remains visible until local midnight, and
preserves the existing urgent-expiry and fresh-redemption priorities.

## Review and reproduction

Run the two interpolation scripts directly; do not rebuild or overwrite the
preserved original keyframe atlas. `prepare-mascot-3d.py` is only for rebuilding
that historical source. `mascot_motion.py` supplies the periodic breathing pass
and previews at actual per-state rates. `inspect-mascot-atlases.py --output-dir
/tmp/kuponi-review` creates all-frame contact sheets on both themes and reports
wrap/midpoint deltas. Deltas are diagnostics, not an artistic pass criterion.

The first motion revision left six-seven untouched. Its follow-up corrects the
cosine palindrome with asymmetric vertical timing and a small horizontal return
path; both masks and amplitude are fractions of CELL. This follow-up still
keeps every production atlas at 256px per cell. Native iOS share animations use
the same 12fps scan / 24fps cheer timing. Screen-state mapping is unchanged.

Animation principles verified against [AnimSchool's idle breakdown](https://blog.animschool.edu/2024/06/14/breathing-life-into-idle-animations/):
overlapping body layers and varied timing support a living idle. These are
animation choices, not a claim that every sinusoid or reversal is a defect.
The original six-seven cosine was seamless but exactly mirrored. A scalar second
harmonic changes timing, not the geometric path. The corrected field uses
(sin(p) + 0.15*sin(2*p))/1.15 vertically and a 3/256*CELL horizontal cosine,
with opposing arm masks and phase pi/3. This produces a narrow closed orbit,
keeps the peak swing close to the original, and anchors face and feet.

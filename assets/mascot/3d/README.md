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

## New keyframe sheets: one landed, three pending

`source/success-keyframes.png` is in use. The other three
(`scan-`, `greeting-`, `concern-keyframes.png`) are measured and rejected, so
those states keep the approved 320px keys until replacements arrive. Each state
picks its own source at build time, so sheets can land one at a time.

What decides it is one number: how much wider the whole silhouette is than the
torso. That ratio is what governs whether a square cell can hold both the body
at full size and the magnifier, and it is also what optical flow can follow —
past roughly 1.4 the magnifier travels so far between poses that the flow loses
it and renders two. `MAX_SILHOUETTE_RATIO` in `scripts/mascot_keys.py` is the
gate; `sheet_ratio()` measures a sheet against it without failing the build.

| sheet | silhouette / torso | in use |
| --- | --- | --- |
| approved 320px art | 1.03-1.06 | the three fallbacks |
| `success` (corrected) | 1.14 | yes |
| `concern` | 1.57 | no |
| `scan` | 1.53 | no |
| `greeting` | 1.58 | no |

The three rejected sheets fail the same way the first `success` sheet did: the
arms are extended too far, which both pushes the magnifier out of the cell and
shrinks the body to about 35% less than every other state once framed so
nothing clips. What a regeneration needs, beyond the existing brief: **the
magnifier and both hands stay close to the body, so the full silhouette is no
wider than about 1.1x the torso**, and the torso fills roughly three quarters
of the cell, as it does in `source/escalation-keyframes.png`. Pose variety has
to come from the body leaning, crouching and rising rather than from the arms
reaching out. The corrected `success` sheet is the worked example.

`scripts/mascot_keys.py` keys the green, finds each pose by the empty columns
around it, and crops on the feet rather than on the nominal grid — needed
because these sheets drift up to 53px vertically between cells, and because two
`greeting` poses cross the cell boundary into each other. It solves the window
size against a torso measured at the output scale, so the character lands the
size he already is, then widens the window if any pose reaches higher than that
size allows, so a raised arm is never cut off at the top of the cell.

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
Success has since moved to `source/success-keyframes.png` and a genuine
four-pose cycle, `[0,1,2,3,0]` with `[7,8,8,13]`. It was the one state the
approved art could not cycle: only two of its four poses shared an
expression, so `[0,1,0]` with `[12,24]` went out to one pose and came back
the same way — the bounce this whole upgrade exists to remove. The other
three states still run the budgets above from the approved keys.
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

# 3D mascot animation assets

Status: integrated. The four `*-smooth.webp` (lossless) production atlases each contain
36 transparent 256px frames in a 6x6 grid. Playback is 24fps, a 1.5-second loop.
`preview-smooth.webp` previews all actions on light and dark backgrounds.
`mascot-atlas.png` preserves the approved original keyframes for regeneration.
The opaque source draft and old preview are not referenced by the application.

Reference: user-provided `original_app_mascot.png`.
Generated using the built-in image generation tool on 2026-09-10.

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
All four loops have 36 frames, including their return motion. These are rendered
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
Rows: scanning, welcoming wave, celebration, concerned reminder. Minimal movement
between neighboring frames for ping-pong playback. No labels or backdrop.

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

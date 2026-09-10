# 3D mascot animation assets

Status: integrated. `mascot-atlas.png` is the transparent 1280px production atlas.
`preview.webp` plays the four actions side by side. The unprocessed source draft
has a baked-in checkerboard and is not referenced by the application.

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
Playback uses four generated poses at 260ms per frame, forward and backward.
Concern uses three poses to avoid a discontinuous fourth pose. This is a rendered
3D-style frame animation, not a rigged 3D model or interpolated 24fps video.

## Integration targets

- `CharacterScene`: onboarding.
- `CharacterSpotlight`: all direct uses plus `MascotLoadingState` and `EmptyState`.
- `FloatingMascot`: notifications, retaining drag behavior.
- `MascotSprite`: sharing empty state.
- Both `targets/add-share` and `targets/share`: native iOS share extensions.

Widget artwork is unchanged by this replacement. React playback stops when the
screen loses focus, the application backgrounds, or Reduce Motion is enabled.
Both iOS extensions use the same atlas with native image animation and respond
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
the app atlas, preview, and copies for the two native asset catalogs.

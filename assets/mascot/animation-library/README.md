# Mascot animation library

Saved for reuse. Adding files here does not enable anything in the application.
Existing integrations elsewhere are left unchanged.

| Animation | Saved atlas | Playback |
| --- | --- | --- |
| Scan / loading | [scan](../3d/scan-smooth.webp) | 36 frames, 6×6, 24fps |
| Greeting | [greeting](../3d/greeting-smooth.webp) | 36 frames, 6×6, 24fps |
| Success | [success](../3d/success-smooth.webp) | 36 frames, 6×6, 24fps |
| Concern | [concern](../3d/concern-smooth.webp) | 36 frames, 6×6, 24fps |
| Six–seven | [six–seven](../3d/six-seven-smooth.webp) | 36 frames, 6×6, 24fps |
| Booty dance — **not integrated** | [dance](booty-dance/atlas.webp) | 48 frames, 8×6, 24fps |

All atlas cells are 256×256 with transparency. Existing files are preserved at
their original paths, avoiding duplicate production assets.

Dance deliverables: `booty-dance/source.png` (unaltered generation),
`keyframes.png` (cleaned sheet), `atlas.webp` (sprite atlas), `animation.webp`
(transparent animated WebP), `preview.webp` (light/dark animated preview).
The dance loops in two seconds. No sound. When integrated later, honor Reduce
Motion and pause playback when the screen/app is inactive.

## Generation and reproduction

Created 2026-09-11 with the built-in image generation tool (`imagegen`), using
the user's `original_app_mascot.png` as identity reference. Prompt: faithful
cobalt-blue rounded-square soft 3D mascot, rear three-quarter playful booty-wiggle,
looking back smiling, hands near hips, knees slightly bent; six small-change
poses in a 3×2 sheet, fixed camera and planted feet, no magnifier/accessories,
no text, transparent background, simple toy anatomy.

The returned sheet contained a checkerboard. Locally approved processing removes
border-connected neutral background while preserving the eyes. Continuous mesh
deformation of the first pose produces 48 smooth frames with hip sway and bounce;
these are locally rendered intermediate frames, not 48 independent AI drawings
or a rigged 3D model. Rebuild with `scripts/prepare-booty-dance.py` (Pillow, NumPy,
OpenCV). Original artwork and all other animations remain unchanged.

#!/bin/bash
# Capture Coupon Master on ten representative Android viewport/font profiles.
# The connected device is restored to its original display settings on exit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/test-results/android-device-matrix"
APP_ID="com.itaykarkason.couponmaster"

find_adb() {
  if command -v adb >/dev/null 2>&1; then
    command -v adb
  elif [ -x "${ANDROID_HOME:-}/platform-tools/adb" ]; then
    printf '%s\n' "$ANDROID_HOME/platform-tools/adb"
  elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
    printf '%s\n' "$HOME/Library/Android/sdk/platform-tools/adb"
  else
    return 1
  fi
}

ADB="$(find_adb || true)"
if [ -z "$ADB" ]; then
  echo "ADB לא נמצא."
  exit 1
fi

SERIAL="${ANDROID_SERIAL:-$($ADB devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')}"
if [ -z "$SERIAL" ]; then
  echo "לא נמצא מכשיר Android מאושר."
  exit 1
fi

if ! "$ADB" -s "$SERIAL" shell pm path "$APP_ID" >/dev/null 2>&1; then
  echo "Coupon Master לא מותקנת על המכשיר."
  exit 1
fi

ORIGINAL_SIZE="$($ADB -s "$SERIAL" shell wm size | tr -d '\r')"
ORIGINAL_DENSITY="$($ADB -s "$SERIAL" shell wm density | tr -d '\r')"
ORIGINAL_FONT_SCALE="$($ADB -s "$SERIAL" shell settings get system font_scale | tr -d '\r')"

restore_device() {
  "$ADB" -s "$SERIAL" shell wm size reset >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell wm density reset >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell settings put system font_scale "$ORIGINAL_FONT_SCALE" >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
}
trap restore_device EXIT INT TERM

mkdir -p "$OUTPUT"
printf 'profile\tsize\tdensity\tfont_scale\tlogical_dp\n' > "$OUTPUT/matrix.tsv"

# name|pixel size|density dpi|font scale|approximate logical dp
PROFILES=(
  "01-small-android|720x1280|360|1.00|320x569"
  "02-galaxy-a-small|1080x1920|480|1.15|360x640"
  "03-pixel-4a|1080x2160|440|1.00|393x785"
  "04-redmi-note-8-pro|1080x2340|440|1.40|393x851"
  "05-pixel-8|1080x2400|420|1.00|411x914"
  "06-galaxy-s-compact|1440x2560|560|1.30|411x731"
  "07-galaxy-s-tall|1440x2960|560|1.00|411x846"
  "08-large-android|1440x3200|560|1.15|411x914"
  "09-fold-cover|904x2316|420|1.30|344x882"
  "10-android-tablet|1600x2560|320|1.00|800x1280"
)

echo "שומר צילומים ב־$OUTPUT"
for profile in "${PROFILES[@]}"; do
  IFS='|' read -r name size density font_scale logical_dp <<< "$profile"
  echo "מצלם $name ($logical_dp dp, text ×$font_scale)..."
  "$ADB" -s "$SERIAL" shell wm size "$size" >/dev/null
  "$ADB" -s "$SERIAL" shell wm density "$density" >/dev/null
  "$ADB" -s "$SERIAL" shell settings put system font_scale "$font_scale" >/dev/null
  "$ADB" -s "$SERIAL" shell am force-stop "$APP_ID" >/dev/null
  "$ADB" -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  # The native launch treatment must finish before visual capture; otherwise
  # the matrix records a transition frame instead of the actual screen.
  sleep 6
  "$ADB" -s "$SERIAL" exec-out screencap -p > "$OUTPUT/$name.png"
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$size" "$density" "$font_scale" "$logical_dp" >> "$OUTPUT/matrix.tsv"
done

echo "הושלמו 10 פרופילים. הגדרות המכשיר משוחזרות."
echo "$OUTPUT"

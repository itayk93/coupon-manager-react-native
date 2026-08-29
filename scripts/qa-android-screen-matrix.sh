#!/bin/bash
# Capture core authenticated screens across ten representative Android layouts.
# Requires a running, logged-in emulator. Restores display settings on exit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/test-results/android-screen-matrix"
APP_ID="com.itaykarkason.couponmaster"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
SERIAL="${ANDROID_SERIAL:-emulator-5554}"

if [ ! -x "$ADB" ]; then
  echo "ADB לא נמצא: $ADB"
  exit 1
fi
if ! "$ADB" devices | awk -v serial="$SERIAL" '$1 == serial && $2 == "device" { found=1 } END { exit !found }'; then
  echo "האמולטור $SERIAL לא פעיל."
  exit 1
fi
if ! "$ADB" -s "$SERIAL" shell pm path "$APP_ID" >/dev/null 2>&1; then
  echo "Coupon Master לא מותקנת באמולטור."
  exit 1
fi

ORIGINAL_FONT_SCALE="$($ADB -s "$SERIAL" shell settings get system font_scale | tr -d '\r')"

restore_emulator() {
  "$ADB" -s "$SERIAL" shell wm size reset >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell wm density reset >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell settings put system font_scale "$ORIGINAL_FONT_SCALE" >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell settings put system show_touches 0 >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" shell settings put system pointer_location 0 >/dev/null 2>&1 || true
}
trap restore_emulator EXIT INT TERM

mkdir -p "$OUTPUT"
printf 'device\tscreen\tpixel_size\tdensity\tfont_scale\tlogical_dp\tfile\n' > "$OUTPUT/matrix.tsv"

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

SCREENS=(
  "dashboard|/"
  "coupons|/coupons"
  "statistics|/statistics"
  "sharing|/sharing"
  "settings|/settings"
  "notifications|/notifications"
  "profile|/profile"
  "add-coupon|/coupons/add"
  "scanner|/scanner"
)

capture() {
  local device="$1" screen="$2" size="$3" density="$4" font_scale="$5" logical_dp="$6"
  local file="$OUTPUT/${device}__${screen}.png"
  "$ADB" -s "$SERIAL" exec-out screencap -p > "$file"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$device" "$screen" "$size" "$density" "$font_scale" "$logical_dp" "$(basename "$file")" \
    >> "$OUTPUT/matrix.tsv"
}

for profile in "${PROFILES[@]}"; do
  IFS='|' read -r device size density font_scale logical_dp <<< "$profile"
  echo "[$device] $logical_dp dp, text ×$font_scale"
  "$ADB" -s "$SERIAL" shell wm size "$size" >/dev/null
  "$ADB" -s "$SERIAL" shell wm density "$density" >/dev/null
  "$ADB" -s "$SERIAL" shell settings put system font_scale "$font_scale" >/dev/null
  "$ADB" -s "$SERIAL" shell settings put system show_touches 0 >/dev/null
  "$ADB" -s "$SERIAL" shell settings put system pointer_location 0 >/dev/null

  "$ADB" -s "$SERIAL" shell am force-stop "$APP_ID" >/dev/null
  "$ADB" -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 6

  for screen_spec in "${SCREENS[@]}"; do
    IFS='|' read -r screen route <<< "$screen_spec"
    echo "  מצלם $screen"
    "$ADB" -s "$SERIAL" shell am start \
      -a android.intent.action.VIEW \
      -d "couponmaster://$route" \
      "$APP_ID" >/dev/null
    # Expo Router may need a few seconds to resolve the deep link and hydrate
    # async screen data on a cold/reshaped emulator. Capturing earlier records
    # the previous route or a blank transition frame.
    sleep 5
    capture "$device" "$screen" "$size" "$density" "$font_scale" "$logical_dp"
  done
done

echo "הושלמו ${#PROFILES[@]} מכשירים × ${#SCREENS[@]} מסכים."
echo "$OUTPUT"

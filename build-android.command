#!/bin/bash
#
# Build Coupon Master in Release, install it on a connected Android device and
# launch it. The installed app runs standalone, without Metro or a cable.
#
# Usage: ./build-android.command [--clean] [--device SERIAL]
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

APP_ID="com.itaykarkason.couponmaster"
APK="$DIR/android/app/build/outputs/apk/release/app-release.apk"
LOG="$DIR/build/last-android-build.log"
CLEAN=0
DEVICE_SERIAL=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --clean)
      CLEAN=1
      shift
      ;;
    --device)
      if [ "$#" -lt 2 ]; then
        echo "❌ חסר serial אחרי --device."
        exit 1
      fi
      DEVICE_SERIAL="$2"
      shift 2
      ;;
    *)
      echo "❌ דגל לא מוכר: $1"
      exit 1
      ;;
  esac
done

mkdir -p "$DIR/build"

find_adb() {
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return
  fi

  for candidate in \
    "${ANDROID_HOME:-}/platform-tools/adb" \
    "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
    "$HOME/Library/Android/sdk/platform-tools/adb"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  return 1
}

ADB="$(find_adb || true)"
if [ -z "$ADB" ]; then
  echo "❌ ADB לא נמצא. התקן Android SDK Platform-Tools דרך Android Studio."
  exit 1
fi

# Gradle needs the SDK root even when adb was found through its absolute path.
export ANDROID_HOME="$(cd "$(dirname "$ADB")/.." && pwd)"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

mapfile_devices() {
  "$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }'
}

if [ -n "$DEVICE_SERIAL" ]; then
  if ! mapfile_devices | grep -Fxq "$DEVICE_SERIAL"; then
    echo "❌ המכשיר $DEVICE_SERIAL לא מחובר או לא מאושר."
    "$ADB" devices -l
    exit 1
  fi
else
  DEVICE_SERIAL="$(mapfile_devices | head -n 1)"
fi

if [ -z "$DEVICE_SERIAL" ]; then
  echo "❌ לא נמצא מכשיר Android מאושר."
  echo "   פתח את המכשיר, הפעל USB debugging ואשר את חלון ההרשאה."
  echo "   מצב החיבור:"
  "$ADB" devices -l
  exit 1
fi

DEVICE_NAME="$($ADB -s "$DEVICE_SERIAL" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
echo "📱 מכשיר יעד: ${DEVICE_NAME:-unknown} ($DEVICE_SERIAL)"

if [ ! -d node_modules ]; then
  echo "📦 מתקין dependencies..."
  npm install
fi

if [ "$CLEAN" -eq 1 ]; then
  echo "🧹 מנקה build קודם..."
  (cd android && ./gradlew clean)
fi

echo "🔨 בונה Release (לוג: $LOG)..."
set +e
(cd android && ./gradlew assembleRelease) > "$LOG" 2>&1
BUILD_STATUS=$?
set -e

if [ "$BUILD_STATUS" -ne 0 ]; then
  echo "❌ הבנייה נכשלה (קוד $BUILD_STATUS)."
  grep -E "FAILURE:|^\* What went wrong:|error:" "$LOG" | tail -n 12 || true
  echo "   הפלט המלא: $LOG"
  exit "$BUILD_STATUS"
fi

if [ ! -f "$APK" ]; then
  echo "❌ הבנייה הסתיימה, אבל APK לא נמצא: $APK"
  exit 1
fi

echo "📲 מתקין..."
set +e
INSTALL_OUT="$("$ADB" -s "$DEVICE_SERIAL" install -r "$APK" 2>&1)"
INSTALL_STATUS=$?
set -e
echo "$INSTALL_OUT"

if [ "$INSTALL_STATUS" -ne 0 ]; then
  if printf '%s' "$INSTALL_OUT" | grep -q "INSTALL_FAILED_USER_RESTRICTED"; then
    REMOTE="/sdcard/Download/coupon-master.apk"
    echo
    echo "⚠️  המכשיר חוסם התקנה דרך USB (MIUI). עובר להתקנה ידנית."
    echo "📤 מעתיק את ה-APK לטלפון: $REMOTE"
    "$ADB" -s "$DEVICE_SERIAL" push "$APK" "$REMOTE"
    echo
    echo "עכשיו בטלפון:"
    echo "  1. פתח את אפליקציית 'קבצים' / 'מנהל הקבצים'"
    echo "  2. לך לתיקייה Download"
    echo "  3. הקש על coupon-master.apk ואשר את ההתקנה"
    echo "     (בפעם הראשונה: אשר 'התקנת אפליקציות לא ידועות' למנהל הקבצים)"
    exit 0
  fi
  echo "❌ ההתקנה נכשלה."
  exit "$INSTALL_STATUS"
fi

echo "🚀 מפעיל..."
"$ADB" -s "$DEVICE_SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "✅ האפליקציה מותקנת ופועלת במצב עצמאי."

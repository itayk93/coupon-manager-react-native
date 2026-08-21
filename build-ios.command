#!/bin/bash
#
# Build Coupon Master in Release, install it on the connected iPhone and launch
# it. The app then runs standalone — no Metro, no cable.
#
# Usage:  ./build-ios.command [--pods] [--clean]
#           --pods   force a CocoaPods reinstall even if nothing looks stale
#           --clean  wipe derived data first
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

WORKSPACE="ios/CouponMaster.xcworkspace"
SCHEME="CouponMaster"
BUNDLE_ID="com.itaykarkason.couponmaster"
DERIVED="$DIR/build"
APP_PATH="$DERIVED/Build/Products/Release-iphoneos/CouponMaster.app"
LOG="$DIR/build/last-build.log"

FORCE_PODS=0
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --pods) FORCE_PODS=1 ;;
    --clean) CLEAN=1 ;;
    *) echo "⚠️  דגל לא מוכר: $arg" ;;
  esac
done

# Any failure past this point prints where to look instead of scrolling away.
trap 'status=$?; if [ $status -ne 0 ]; then
  echo ""
  echo "❌ הבנייה נכשלה (קוד $status)."
  if [ -f "$LOG" ]; then
    echo "   שגיאות אחרונות:"
    grep -E "^(error|.*error:)" "$LOG" | tail -n 10 || true
    echo "   הפלט המלא: $LOG"
  fi
fi' EXIT

echo "================================================="
echo "   Coupon Master - iOS Release Build & Deploy    "
echo "================================================="

# 1. Keep CocoaPods in step with node_modules ---------------------------------
# The usual way this script breaks: npm pulls a new native package version and
# the Pods project keeps compiling the old one's file list. xcodebuild then
# fails with "Build input files cannot be found" on files that no longer exist.
NEEDS_PODS=$FORCE_PODS
if [ ! -d "ios/Pods" ] || [ ! -f "ios/Podfile.lock" ]; then
  NEEDS_PODS=1
elif [ node_modules/.package-lock.json -nt ios/Podfile.lock ] 2>/dev/null; then
  NEEDS_PODS=1
  echo "ℹ️  התלויות ב-node_modules חדשות יותר מ-Podfile.lock."
fi

if [ "$NEEDS_PODS" -eq 1 ]; then
  echo "📦 מריץ pod install..."
  pod install --project-directory=ios
else
  echo "📦 ה-Pods מעודכנים."
fi

# 2. Find the connected iPhone ------------------------------------------------
# Read the state column rather than grepping the whole line: "unavailable"
# contains "available", and a stale hard-coded UDID fails later and less clearly.
echo "🔍 מחפש אייפון מחובר וזמין..."
DEVICE_LINE=$(xcrun devicectl list devices 2>/dev/null | awk '$0 ~ /available \(paired\)|^.*[[:space:]]available[[:space:]]/ && $0 !~ /unavailable/' | head -n 1 || true)
DEVICE_ID=$(printf '%s' "$DEVICE_LINE" | grep -oE "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}" | head -n 1 || true)

if [ -z "$DEVICE_ID" ]; then
  echo "❌ לא נמצא אייפון זמין."
  echo "   בדוק: הכבל מחובר, המכשיר פתוח, ואישרת \"Trust This Computer\"."
  echo "   רשימת המכשירים כרגע:"
  xcrun devicectl list devices 2>&1 | sed 's/^/     /'
  exit 1
fi

DEVICE_NAME=$(printf '%s' "$DEVICE_LINE" | awk -F'  +' '{print $1}')
echo "📱 מכשיר יעד: ${DEVICE_NAME:-unknown} ($DEVICE_ID)"

# 3. Build --------------------------------------------------------------------
if [ "$CLEAN" -eq 1 ]; then
  echo "🧹 מנקה derived data..."
  rm -rf "$DERIVED"
else
  # Always ensure widget extension target is rebuilt when targets/ changes
  rm -rf "$DERIVED/Build/Intermediates.noindex/CouponMaster.build/Release-iphoneos/CouponWidget.build" \
         "$DERIVED/Build/Products/Release-iphoneos/CouponWidget.appex" \
         "$APP_PATH/PlugIns/CouponWidget.appex" 2>/dev/null || true
fi

mkdir -p "$DERIVED"
echo "🔨 בונה Release של האפליקציה והווידג'ט (הפלט המלא ב-$LOG)..."

# -allowProvisioningUpdates lets Xcode refresh an expired profile by itself,
# which is otherwise a silent failure the moment a certificate rolls over.
set +e
xcodebuild -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  > "$LOG" 2>&1
BUILD_STATUS=$?
set -e

if [ $BUILD_STATUS -ne 0 ]; then
  exit $BUILD_STATUS
fi

if [ ! -d "$APP_PATH" ]; then
  echo "❌ הבנייה הסתיימה אבל האפליקציה לא נמצאה: $APP_PATH"
  exit 1
fi

echo "✅ נבנה: $(du -sh "$APP_PATH" | cut -f1)"

# 4. Install and launch -------------------------------------------------------
echo "📲 מתקין על האייפון..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo "🚀 מפעיל..."
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

trap - EXIT
echo ""
echo "================================================="
echo "  ✅ ההתקנה וההפעלה הסתיימו בהצלחה!"
echo "  📱 האפליקציה פועלת במצב Standalone עצמאי."
echo "  🔌 ניתן לנתק את הכבל בכל עת."
echo "================================================="

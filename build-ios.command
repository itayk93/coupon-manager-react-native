#!/bin/bash
#
# Build Coupon Master in Release, install it on the connected iPhone and launch
# it. The app then runs standalone — no Metro, no cable.
#
# Usage:  ./build-ios.command [--pods] [--clean] [--all|--device <id|name>] [--list]
#           --pods    force a CocoaPods reinstall even if nothing looks stale
#           --clean   wipe derived data first
#           --device  target this iPhone (identifier or part of its name) and
#                     remember it in .ios-device for the next runs
#           --all     target every available iPhone (the default)
#           --list    print the connected iPhones and exit
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
DEVICE_PICK="${DEVICE_ID:-}"
DEVICE_FILE="$DIR/.ios-device"
LIST_ONLY=0
TARGET_ALL=1
CURRENT_PHASE="build"
[ -n "$DEVICE_PICK" ] && TARGET_ALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --pods) FORCE_PODS=1 ;;
    --clean) CLEAN=1 ;;
    --list) LIST_ONLY=1 ;;
    --all) TARGET_ALL=1; DEVICE_PICK="" ;;
    --device) shift; DEVICE_PICK="${1:-}"; TARGET_ALL=0 ;;
    --device=*) DEVICE_PICK="${1#--device=}"; TARGET_ALL=0 ;;
    *) echo "⚠️  דגל לא מוכר: $1" ;;
  esac
  shift
done

# Every connected iPhone, one "name<TAB>identifier" line each. Read the state
# column rather than grepping the whole line: "unavailable" contains "available".
list_devices() {
  xcrun devicectl list devices 2>/dev/null | awk -F"  +" '
    NF >= 4 && $4 !~ /unavailable/ && $4 ~ /available|connected/ { print $1 "\t" $3 }'
}

if [ "$LIST_ONLY" -eq 1 ]; then
  echo "📱 מכשירים מחוברים:"
  list_devices | sed 's/^/   /'
  exit 0
fi

# Any failure past this point prints where to look instead of scrolling away.
trap 'status=$?; if [ $status -ne 0 ]; then
  echo ""
  if [ "$CURRENT_PHASE" = "deploy" ]; then
    echo "❌ ההתקנה או ההפעלה נכשלה (קוד $status)."
  else
    echo "❌ הבנייה נכשלה (קוד $status)."
  fi
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
UPDATE_PODS=0
if [ ! -d "ios/Pods" ] || [ ! -f "ios/Podfile.lock" ]; then
  NEEDS_PODS=1
elif [ node_modules/.package-lock.json -nt ios/Podfile.lock ] 2>/dev/null; then
  NEEDS_PODS=1
  UPDATE_PODS=1
  echo "ℹ️  התלויות ב-node_modules חדשות יותר מ-Podfile.lock."
fi

if [ "$NEEDS_PODS" -eq 1 ]; then
  if [ "$UPDATE_PODS" -eq 1 ] || { [ "$FORCE_PODS" -eq 1 ] && [ -f "ios/Podfile.lock" ]; }; then
    echo "📦 מסנכרן גרסאות CocoaPods..."
    (cd ios && pod update --no-repo-update)
  else
    echo "📦 מתקין CocoaPods..."
    pod install --project-directory=ios
  fi
else
  echo "📦 ה-Pods מעודכנים."
fi

# 2. Find the connected iPhone ------------------------------------------------
# With two iPhones plugged in, picking the first one silently deploys to the
# wrong phone, so an ambiguous match stops and asks instead of guessing.
echo "🔍 מחפש אייפון מחובר וזמין..."
DEVICES=$(list_devices)
if [ "$TARGET_ALL" -eq 1 ]; then
  MATCHES="$DEVICES"
elif [ -n "$DEVICE_PICK" ]; then
  MATCHES=$(printf '%s\n' "$DEVICES" | grep -iF "$DEVICE_PICK" || true)
  if [ -z "$MATCHES" ]; then
    echo "⚠️  \"$DEVICE_PICK\" לא מחובר כרגע — בוחר מבין הזמינים."
    MATCHES="$DEVICES"
  fi
else
  MATCHES="$DEVICES"
fi

COUNT=$(printf '%s' "$MATCHES" | grep -c . || true)
if [ "$COUNT" -eq 0 ]; then
  echo "❌ לא נמצא אייפון זמין."
  echo "   בדוק: הכבל מחובר, המכשיר פתוח, ואישרת \"Trust This Computer\"."
  echo "   רשימת המכשירים כרגע:"
  xcrun devicectl list devices 2>&1 | sed 's/^/     /'
  exit 1
fi
if [ "$TARGET_ALL" -eq 0 ] && [ "$COUNT" -gt 1 ]; then
  echo "❌ יותר ממכשיר אחד מחובר. בחר אחד:"
  printf '%s\n' "$MATCHES" | sed 's/^/     /'
  echo "   לדוגמה:  ./build-ios.command --device \"$(printf '%s' "$MATCHES" | head -n 1 | cut -f1)\""
  exit 1
fi

if [ "$TARGET_ALL" -eq 0 ]; then
  DEVICE_ID=$(printf '%s' "$MATCHES" | cut -f2)
  printf '%s\n' "$DEVICE_ID" > "$DEVICE_FILE"
fi

echo "📱 מכשירי יעד:"
printf '%s\n' "$MATCHES" | sed 's/^/   /'

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
CURRENT_PHASE="deploy"

# 4. Install and launch -------------------------------------------------------
# Each device gets its own process so two phones install and launch in parallel.
deploy_device() {
  local device_name="$1"
  local device_id="$2"
  local install_out launch_out status

  echo "📲 [$device_name] מתקין..."
  set +e
  install_out=$(xcrun devicectl device install app --device "$device_id" "$APP_PATH" 2>&1)
  status=$?
  set -e
  printf '%s\n' "$install_out"
  if [ $status -ne 0 ]; then
    case "$install_out" in
      *"must be paired"*) echo "👉 [$device_name] אשר Pairing ו-Trust." ;;
      *"Developer Mode"*|*0xe800801c*) echo "👉 [$device_name] הפעל Developer Mode." ;;
      *0xe8008012*|*"provisioning profile cannot be installed"*) echo "👉 [$device_name] הפרופיל לא כולל את המכשיר." ;;
    esac
    return $status
  fi

  local launch_attempt=1
  local max_launch_attempts=12
  echo "🚀 [$device_name] מפעיל..."
  while [ $launch_attempt -le $max_launch_attempts ]; do
    set +e
    launch_out=$(xcrun devicectl device process launch --device "$device_id" "$BUNDLE_ID" 2>&1)
    status=$?
    set -e
    if [ $status -eq 0 ]; then
      printf '%s\n' "$launch_out"
      return 0
    fi

    case "$launch_out" in
      *"could not be, unlocked"*)
        if [ $launch_attempt -lt $max_launch_attempts ]; then
          echo "🔒 [$device_name] נעול. פתח את המסך — מנסה שוב בעוד 5 שניות ($launch_attempt/$max_launch_attempts)..."
          sleep 5
          launch_attempt=$((launch_attempt + 1))
          continue
        fi
        echo "❌ [$device_name] נשאר נעול במשך דקה. האפליקציה מותקנת, אך לא הופעלה."
        ;;
      *"not been explicitly trusted"*|*"invalid code signature"*)
        echo "👉 [$device_name] אשר את המפתח תחת VPN & Device Management."
        ;;
    esac
    printf '%s\n' "$launch_out"
    return $status
  done
}

echo "📲 מתקין ומפעיל במקביל..."
PIDS=()
LOGS=()
NAMES=()
INDEX=0
while IFS=$'\t' read -r DEVICE_NAME DEVICE_ID; do
  [ -z "$DEVICE_ID" ] && continue
  DEVICE_LOG="$DERIVED/deploy-$DEVICE_ID.log"
  deploy_device "$DEVICE_NAME" "$DEVICE_ID" 2>&1 | tee "$DEVICE_LOG" &
  PIDS[$INDEX]=$!
  LOGS[$INDEX]="$DEVICE_LOG"
  NAMES[$INDEX]="$DEVICE_NAME"
  INDEX=$((INDEX + 1))
done <<< "$MATCHES"

DEPLOY_STATUS=0
set +e
for ((INDEX=0; INDEX<${#PIDS[@]}; INDEX++)); do
  wait "${PIDS[$INDEX]}"
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    echo "❌ ${NAMES[$INDEX]} נכשל (קוד $STATUS)."
    DEPLOY_STATUS=$STATUS
  fi
done
set -e
[ $DEPLOY_STATUS -ne 0 ] && exit $DEPLOY_STATUS

trap - EXIT
echo ""
echo "================================================="
echo "  ✅ ההתקנה וההפעלה הסתיימו בהצלחה!"
echo "  📱 האפליקציה פועלת במצב Standalone עצמאי."
echo "  🔌 ניתן לנתק את הכבל בכל עת."
echo "================================================="

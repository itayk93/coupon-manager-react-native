#!/bin/bash
set -e

# Navigate to project directory
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "================================================="
echo "   Coupon Master - iOS Release Build & Deploy    "
echo "================================================="

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 1. Detect connected available iPhone
echo "🔍 מחפש אייפון מחובר וזמין..."
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep -i "available" | grep -v "unavailable" | grep -oE "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" | head -n 1 || true)

if [ -z "$DEVICE_ID" ]; then
  # Fallback to default known identifier
  DEVICE_ID="C2BE4B52-1AED-516D-B5BA-659FF0F283B7"
fi

echo "📱 מכשיר יעד: $DEVICE_ID"

# 2. Build Release for iOS (App + Widget)
echo "🔨 בונה גרסת Release מלאה של האפליקציה והווידג'ט..."
xcodebuild -workspace ios/CouponMaster.xcworkspace \
  -scheme CouponMaster \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -derivedDataPath build

APP_PATH="$DIR/build/Build/Products/Release-iphoneos/CouponMaster.app"

if [ ! -d "$APP_PATH" ]; then
  echo "❌ שגיאה: קובץ האפליקציה לא נמצא בנתיב: $APP_PATH"
  exit 1
fi

# 3. Install on Device
echo "📲 מתקין את האפליקציה על האייפון..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

# 4. Launch App
echo "🚀 מפעיל את האפליקציה באייפון..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.itaykarkason.couponmaster

echo ""
echo "================================================="
echo "  ✅ ההתקנה וההפעלה הסתיימו בהצלחה!"
echo "  📱 האפליקציה פועלת במצב Standalone עצמאי."
echo "  🔌 ניתן לנתק את הכבל בכל עת."
echo "================================================="

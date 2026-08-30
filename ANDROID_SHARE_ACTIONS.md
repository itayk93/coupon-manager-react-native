# Android Share Actions And Coupon Usage Import

## Summary

Android now supports the same screenshot share flows as iOS:

- `הוספת קופון חדש`
- `סימון שימוש בקופון`

Both entries appear in the Android share sheet for shared images and screenshots.

## Android Implementation

- `android/app/src/main/AndroidManifest.xml`
  - Adds two `activity-alias` entries that target `MainActivity`.
  - Each alias accepts `ACTION_SEND` with `image/*`.
  - Each alias carries `com.itaykarkason.couponmaster.SHARE_MODE` metadata:
    - `add` for adding a new coupon.
    - `usage` for marking coupon usage.

- `android/app/src/main/java/com/itaykarkason/couponmaster/MainActivity.kt`
  - Adds `onNewIntent`.
  - Calls `setIntent(intent)` so sharing into an already-open app uses the latest shared image.

- `modules/coupon-widget/android/src/main/java/com/itaykarkason/couponmaster/widget/CouponWidgetModule.kt`
  - Reads the shared image from `Intent.EXTRA_STREAM`.
  - Downscales it before base64 encoding.
  - Detects the chosen share action mode from the Android alias component or metadata.
  - Stores the pending job with `mode: "add" | "usage" | "choose"`.

- `android/app/src/main/res/drawable/ic_coupon_add_share.xml`
  - Native Android vector icon for adding a coupon.

- `android/app/src/main/res/drawable/ic_coupon_usage_share.xml`
  - Native Android vector icon for marking coupon usage.

## Duplicate Usage Handling

Coupon usage screenshot imports now detect duplicates using the same rule on client and server:

- same coupon
- same amount, rounded to cents/agorot
- same normalized place
- same timestamp minute

The server rule is enforced by:

- `supabase/migrations/20260830143000_dedupe_coupon_usage_by_place_amount_time.sql`

The client-side mirror is implemented in:

- `src/lib/usageDuplicateMatch.ts`
- `src/lib/usageDuplicateMatch.test.ts`

The quick usage modal now shows duplicate rows before saving and lets the user open the existing usage row.

## Coupon Trash

Coupon deletion now supports a recoverable trash flow:

- Soft delete moves coupons out of active lists.
- Deleted coupons can be restored.
- Permanent deletion is available for trash items.
- A scheduled purge removes soft-deleted coupons after 30 days.

Main files:

- `supabase/migrations/20260830150000_coupon_soft_delete.sql`
- `supabase/functions/coupon-vault/index.ts`
- `src/hooks/useCoupons.ts`
- `src/screens/coupons/CouponsListScreen.tsx`
- `src/screens/coupons/CouponDetailScreen.tsx`

## Verification

Commands run:

```sh
npm run typecheck -- --noEmit
npm test -- --pool=threads
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:assembleDebug
```

Results:

- TypeScript: passed.
- Vitest: 26 test files passed, 184 tests passed.
- Android debug build: passed.

## Supabase Deployment

Required remote updates:

- Push all pending migrations.
- Deploy `coupon-vault` after the soft-delete changes.

Commands:

```sh
set -a
source .env.supabase.local
set +a

supabase db push --password "$SUPABASE_DB_PASSWORD" --yes
supabase functions deploy coupon-vault --project-ref "$SUPABASE_PROJECT_REF" --use-api --yes
```

## APK

Debug APK path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install command:

```sh
ANDROID_HOME="$HOME/Library/Android/sdk" "$HOME/Library/Android/sdk/platform-tools/adb" install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Connected test device:

```text
aykbknj7ztaiifz5
```

Install attempt result:

```text
INSTALL_FAILED_USER_RESTRICTED: Install canceled by user
```

Meaning: the APK was built, but the connected Android device blocked the install. Enable USB install / approve the install prompt on the device, then rerun the install command above.

## Manual Test Checklist

1. Open any image or screenshot on Android.
2. Tap Share.
3. Confirm both actions appear:
   - `הוספת קופון חדש`
   - `סימון שימוש בקופון`
4. Choose `הוספת קופון חדש`.
5. Confirm the app opens and starts coupon detection.
6. Share the same image again.
7. Choose `סימון שימוש בקופון`.
8. Confirm the app opens the quick usage flow.
9. Import a screenshot with a usage already saved.
10. Confirm duplicate rows are marked and not saved again.

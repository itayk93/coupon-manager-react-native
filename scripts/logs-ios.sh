#!/bin/sh

set -eu

APP_PROCESS="CouponMaster"
DEVICE_UDID="${1:-}"

if ! command -v idevice_id >/dev/null 2>&1 || ! command -v idevicesyslog >/dev/null 2>&1; then
  echo "Missing iPhone logging tools. Install them with: brew install libimobiledevice" >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "Missing log filter. Install it with: brew install ripgrep" >&2
  exit 1
fi

if [ -z "$DEVICE_UDID" ]; then
  DEVICES="$(idevice_id -l)"
  DEVICE_COUNT="$(printf '%s\n' "$DEVICES" | sed '/^$/d' | wc -l | tr -d ' ')"

  if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "No unlocked iPhone found. Connect it by USB, unlock it, and trust this Mac." >&2
    exit 1
  fi

  if [ "$DEVICE_COUNT" -gt 1 ]; then
    echo "More than one iPhone found. Run: npm run logs:ios -- DEVICE_UDID" >&2
    printf '%s\n' "$DEVICES" >&2
    exit 1
  fi

  DEVICE_UDID="$DEVICES"
fi

echo "Streaming live iPhone logs for $APP_PROCESS. Press Ctrl-C to stop."
idevicesyslog --udid "$DEVICE_UDID" --exit --process "$APP_PROCESS" \
  | rg --line-buffered 'ReactNativeJS|<Warning>|<Error>|<Fault>|[Ee]xception|[Tt]erminat|[Ff]atal|[Cc]rash'

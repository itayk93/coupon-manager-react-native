import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import type { NotificationContentAttachmentIos } from "expo-notifications";
import { expiryFaceKey, type ExpiryFaceKey } from "./expiryFaceKey";

/**
 * Kuponi's face on the reminders the phone schedules for itself.
 *
 * iOS never lets an app swap its icon on a banner without the Communication
 * Notifications entitlement, which a free developer team cannot sign. What it
 * does allow is an attachment: a thumbnail beside the text. So each local
 * expiry reminder carries the face for how close the deadline is, on the same
 * ladder the server uses for push (see expiryFaceKey.ts).
 *
 * Android has no per-notification image for local notifications in
 * expo-notifications, and a reminder scheduled there only fires on a device
 * with no push token anyway, so this is iOS only.
 */

// The same 256px files the PWA serves, so there is one drawing per face.
const FACES: Record<ExpiryFaceKey, number> = {
  "expiry-week": require("../../public/notification-icons/expiry-week.png"),
  "expiry-soon": require("../../public/notification-icons/expiry-soon.png"),
  "expiry-tomorrow": require("../../public/notification-icons/expiry-tomorrow.png"),
  "expiry-today": require("../../public/notification-icons/expiry-today.png"),
};

let serial = 0;

/**
 * An attachment for one scheduled reminder, or undefined when anything about
 * the image is off — a reminder without a face is still a reminder.
 *
 * iOS moves an attached file into its own store when the notification is
 * scheduled, so every reminder gets a fresh copy rather than sharing one.
 */
export async function expiryFaceAttachment(
  daysLeft: number,
): Promise<NotificationContentAttachmentIos[] | undefined> {
  if (Platform.OS !== "ios") return undefined;
  try {
    const key = expiryFaceKey(daysLeft);
    const asset = Asset.fromModule(FACES[key]);
    await asset.downloadAsync();
    if (!asset.localUri) return undefined;

    serial += 1;
    const copy = new File(Paths.cache, `kuponi-${key}-${Date.now()}-${serial}.png`);
    await new File(asset.localUri).copy(copy);
    return [{ identifier: key, url: copy.uri, type: null, typeHint: "public.png" }];
  } catch {
    return undefined;
  }
}

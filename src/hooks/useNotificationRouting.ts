import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { setForegroundPresenter } from "@/lib/nativeNotifications";
import { faceKeyForNotification, routeForNotification } from "@/lib/notificationRoute";
import { NOTIFICATION_FACE_IMAGES } from "@/lib/notificationFaceImages";
import { hasIslandHost, pushIsland } from "@/components/ui/Island";

/**
 * Makes a notification lead somewhere, whether it is tapped or arrives while
 * the app is open.
 *
 * Tapped: every push carries the in-app path of the thing it is about, and
 * until now nothing read it — a tap opened the app wherever it had been left.
 * The launch tap is read once the navigator and the session are settled
 * (`ready`), so the auth guard sees the route and can hold it across a login.
 *
 * Open: on a phone with a Dynamic Island the push comes down out of it, with
 * the Kuponi face the server picked, and tapping it goes to the same place.
 * Everywhere else the system banner shows as before.
 */
export function useNotificationRouting(ready: boolean) {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" || !ready) return;

    const open = (response: Notifications.NotificationResponse) => {
      // The launch tap can arrive both as the last response and through the
      // listener; it should navigate once.
      const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.current === id) return;
      handled.current = id;
      Notifications.clearLastNotificationResponse();
      const route = routeForNotification(response.notification.request.content.data);
      if (route) router.push(route as any);
    };

    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    setForegroundPresenter((notification) => {
      if (!hasIslandHost()) return false;
      const { title, body, data } = notification.request.content;
      if (!title) return false;
      const route = routeForNotification(data);
      pushIsland({
        title,
        message: body ?? undefined,
        face: NOTIFICATION_FACE_IMAGES[faceKeyForNotification(data)],
        onPress: route ? () => router.push(route as any) : undefined,
      });
      return true;
    });

    return () => {
      subscription.remove();
      setForegroundPresenter(null);
    };
  }, [ready, router]);
}

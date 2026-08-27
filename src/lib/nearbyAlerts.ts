import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_REGIONS,
  RADIUS_METERS,
  buildTargets,
  mayAlert,
  type NearbyCoupon,
  type NearbyPlace,
  type NearbyTarget,
} from "@/lib/nearbyTargets";

export { buildTargets, mayAlert } from "@/lib/nearbyTargets";
export type { NearbyCoupon, NearbyPlace, NearbyTarget } from "@/lib/nearbyTargets";

/**
 * "You are standing next to a shop where you have money."
 *
 * The whole point of this alert is that it arrives at the one moment it is
 * useful, so everything about it is built to work with the app closed and the
 * network absent:
 *
 *  - The operating system watches the boundaries, not the app. Geofences are a
 *    hardware-assisted OS service; polling GPS ourselves would drain a battery
 *    in an afternoon and is the reason most apps that try this get uninstalled.
 *  - The targets and the wording are written to disk while the app is open.
 *    When the phone crosses a boundary the task reads a file and posts a local
 *    notification — no session, no request, no round trip.
 *  - The location itself never leaves the device. There is no endpoint here to
 *    send it to, which is what the permission screen promises and this is what
 *    makes that promise true.
 *
 * The quiet rules matter as much as the mechanism: somebody who lives above a
 * bakery must not hear about it every morning, or they will switch off every
 * notification the app has.
 */

export const NEARBY_TASK = "coupon-master-nearby-geofence";

/** Fresh wording is fetched at most this often. */
const PHRASE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const TARGETS_KEY = "nearby_targets";
const LAST_ALERT_KEY = "nearby_last_alert";
const ENABLED_KEY = "nearby_enabled";

async function readTargets(): Promise<NearbyTarget[]> {
  try {
    const raw = await AsyncStorage.getItem(TARGETS_KEY);
    return raw ? (JSON.parse(raw) as NearbyTarget[]) : [];
  } catch {
    return [];
  }
}

async function writeTargets(targets: NearbyTarget[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  } catch {
    // Best-effort: without a snapshot the task simply stays quiet.
  }
}

export async function isNearbyEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
  } catch {
    return false;
  }
}

async function setNearbyEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? "true" : "false");
  } catch {
    // Best-effort.
  }
}

/** The written fallback, for a target whose variants never arrived. */
function writtenLine(target: NearbyTarget) {
  return {
    title: `יש לך קופון ב${target.company}`,
    body: `אתה ממש ליד. נשארו לך ${target.remaining.toFixed(2)} ש״ח לנצל כאן.`,
  };
}

/**
 * Ask the server for a few ways of saying it, while there is a network.
 *
 * Failure is fine and expected — offline, signed out, model down. The written
 * line is always there underneath.
 */
async function fetchVariants(target: NearbyTarget): Promise<NearbyTarget["variants"]> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];
    const { data } = await supabase.functions.invoke("phrase-notification", {
      body: {
        type: "nearby_store",
        count: 3,
        payload: {
          company: target.company,
          remaining: target.remaining,
          couponId: target.couponId,
        },
      },
    });
    const variants = (data as any)?.variants;
    return Array.isArray(variants) ? variants.slice(0, 3) : [];
  } catch {
    return [];
  }
}

/**
 * Point the operating system at the places worth watching.
 *
 * Called when the app opens and after the wallet changes. Stopping first is
 * deliberate: geofences are replaced wholesale rather than diffed, because a
 * region left behind for a coupon that has been spent is a notification about
 * money that is not there.
 */
export async function syncNearbyGeofences(
  coupons: NearbyCoupon[],
  places: NearbyPlace[],
): Promise<{ watching: number }> {
  if (Platform.OS === "web") return { watching: 0 };
  if (!(await isNearbyEnabled())) return { watching: 0 };

  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== "granted") return { watching: 0 };

  const fresh = buildTargets(coupons, places);
  const previous = await readTargets();
  const previousById = new Map(previous.map((target) => [target.id, target]));
  const now = Date.now();

  // Wording is carried over until it goes stale, so a wallet that changes
  // daily does not mean a model call a day.
  const targets: NearbyTarget[] = [];
  for (const target of fresh) {
    const old = previousById.get(target.id);
    const stillFresh = old
      && old.variants.length > 0
      && now - old.phrasedAt < PHRASE_TTL_MS
      && Math.abs(old.remaining - target.remaining) < 0.01;
    if (stillFresh) {
      targets.push({ ...target, variants: old.variants, phrasedAt: old.phrasedAt });
      continue;
    }
    const variants = await fetchVariants(target);
    targets.push({ ...target, variants, phrasedAt: variants.length ? now : 0 });
  }

  await writeTargets(targets);

  const registered = await TaskManager.isTaskRegisteredAsync(NEARBY_TASK).catch(() => false);
  if (registered) await Location.stopGeofencingAsync(NEARBY_TASK).catch(() => {});

  if (!targets.length) return { watching: 0 };

  await Location.startGeofencingAsync(
    NEARBY_TASK,
    targets.map((target) => ({
      identifier: target.id,
      latitude: target.latitude,
      longitude: target.longitude,
      radius: RADIUS_METERS,
      notifyOnEnter: true,
      notifyOnExit: false,
    })),
  );

  return { watching: targets.length };
}

/** Turn the whole thing off, and forget what it knew. */
export async function stopNearbyGeofences(): Promise<void> {
  await setNearbyEnabled(false);
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(NEARBY_TASK);
    if (registered) await Location.stopGeofencingAsync(NEARBY_TASK);
  } catch {
    // Already stopped.
  }
  await AsyncStorage.removeItem(TARGETS_KEY).catch(() => {});
}

/**
 * Ask for the permission this needs, in two steps, in that order.
 *
 * iOS will not grant "always" as a first request — it has to be foreground
 * first, then the upgrade. Asking for the upgrade without the first one simply
 * returns denied, which spends the one prompt for nothing.
 */
export async function requestNearbyPermission(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;
  await setNearbyEnabled(true);
  return true;
}

/**
 * The task the OS wakes.
 *
 * Defined at module scope, and this module is imported from the root layout,
 * because the definition has to exist before the system delivers an event —
 * including on a cold start where the app was launched *by* the event.
 */
TaskManager.defineTask(NEARBY_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (data?.eventType !== Location.GeofencingEventType.Enter) return;

  const identifier = data?.region?.identifier;
  if (!identifier) return;

  const targets = await readTargets();
  const target = targets.find((item) => item.id === identifier);
  if (!target) return;

  let history: Record<string, number> = {};
  try {
    const raw = await AsyncStorage.getItem(LAST_ALERT_KEY);
    history = raw ? JSON.parse(raw) : {};
  } catch {
    history = {};
  }

  if (!mayAlert(history[identifier], new Date())) return;

  const line = target.variants.length
    ? target.variants[Math.floor(Math.random() * target.variants.length)]
    : writtenLine(target);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: line.title,
      body: line.body,
      data: { url: `/coupons/${target.couponId}`, type: "nearby_store" },
    },
    // null means now: the person is standing there.
    trigger: null,
  });

  history[identifier] = Date.now();
  await AsyncStorage.setItem(LAST_ALERT_KEY, JSON.stringify(history)).catch(() => {});
});

import { Platform } from "react-native";
import { DeviceMotion } from "expo-sensors";

export type Tilt = {
  /** Roll around the screen's vertical axis, in degrees. Right side down is positive. */
  roll: number;
  /** Pitch around the horizontal axis, in degrees. Top away from you is positive. */
  pitch: number;
};

type Listener = (tilt: Tilt) => void;

const listeners = new Set<Listener>();
let subscription: { remove: () => void } | null = null;
let starting = false;

const MAX_DEG = 45;
// Low-pass smoothing: raw sensor output is jittery, and a sheen riding it
// looks like it is stuttering. Small alpha = heavier smoothing.
const SMOOTHING = 0.12;

let smoothed: Tilt | null = null;

function clamp(deg: number) {
  return Math.max(-MAX_DEG, Math.min(MAX_DEG, deg));
}

/**
 * One device-motion subscription shared by every component that cares about
 * tilt. A coupon list can hold dozens of shimmering logos; each of them
 * opening its own sensor stream would be wasteful.
 */
function start() {
  if (subscription || starting || Platform.OS === "web") return;
  starting = true;

  DeviceMotion.isAvailableAsync()
    .then((available) => {
      starting = false;
      if (!available || listeners.size === 0) return;

      DeviceMotion.setUpdateInterval(16);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const raw: Tilt = {
          roll: clamp((rotation.gamma * 180) / Math.PI),
          pitch: clamp((rotation.beta * 180) / Math.PI),
        };

        smoothed = smoothed
          ? {
              roll: smoothed.roll + (raw.roll - smoothed.roll) * SMOOTHING,
              pitch: smoothed.pitch + (raw.pitch - smoothed.pitch) * SMOOTHING,
            }
          : raw;

        const tilt = smoothed;
        listeners.forEach((listener) => listener(tilt));
      });
    })
    .catch(() => {
      starting = false;
    });
}

function stop() {
  subscription?.remove();
  subscription = null;
  smoothed = null;
}

export function subscribeToTilt(listener: Listener) {
  listeners.add(listener);
  start();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

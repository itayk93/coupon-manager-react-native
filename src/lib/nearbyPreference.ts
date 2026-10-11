import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Cleared on sign-out via localPrivateData. "0" means off; anything else is on. */
const KEY = "nearby_enabled";

const listeners = new Set<(value: boolean) => void>();

export async function readNearbyEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== "0";
  } catch {
    return true;
  }
}

export async function setNearbyEnabled(value: boolean): Promise<void> {
  listeners.forEach((listener) => listener(value));
  try {
    await AsyncStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // The switch still works for this session.
  }
}

/** The "remind me when I'm near a store" switch. On until the user turns it off. */
export function useNearbyEnabled(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(true);
  useEffect(() => {
    let alive = true;
    readNearbyEnabled().then((stored) => alive && setValue(stored));
    listeners.add(setValue);
    return () => {
      alive = false;
      listeners.delete(setValue);
    };
  }, []);
  return [value, (next) => void setNearbyEnabled(next)];
}

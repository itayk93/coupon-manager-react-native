import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Storage adapter for the Supabase auth session.
 *
 * The session holds two long-lived JWTs; persisting them in AsyncStorage
 * leaves them readable by any process that can read app data (and copyable
 * through a cloud backup — now disabled, but still). On native they go into
 * the Keychain / Keystore instead. Web keeps AsyncStorage, which already
 * scopes to the origin.
 *
 * iOS Keychain items and Keystore entries have a small per-item size limit,
 * and a Supabase session is comfortably past it, so the JSON is split across
 * numbered chunks; the `:count` key records how many there are.
 */

const MAX_CHUNK = 1800;

async function secureGet(name: string): Promise<string | null> {
  const count = Number((await SecureStore.getItemAsync(`${name}:count`)) ?? 0);
  if (!count) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(`${name}:${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function secureSet(name: string, value: string): Promise<void> {
  await secureRemove(name);
  const chunks = Math.ceil(value.length / MAX_CHUNK);
  for (let i = 0; i < chunks; i += 1) {
    await SecureStore.setItemAsync(`${name}:${i}`, value.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK));
  }
  await SecureStore.setItemAsync(`${name}:count`, String(chunks));
}

async function secureRemove(name: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${name}:count`)) ?? 0);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${name}:${i}`);
  }
  await SecureStore.deleteItemAsync(`${name}:count`);
}

/**
 * Sessions written before this adapter existed sit in AsyncStorage; move them
 * over on the first read so nobody is silently signed out by the upgrade.
 */
async function secureGetWithMigration(name: string): Promise<string | null> {
  const value = await secureGet(name);
  if (value !== null) return value;
  const legacy = await AsyncStorage.getItem(name);
  if (legacy === null) return null;
  await secureSet(name, legacy);
  await AsyncStorage.removeItem(name);
  return legacy;
}

export const sessionStorage = Platform.OS === "web"
  ? AsyncStorage
  : {
      getItem: secureGetWithMigration,
      setItem: secureSet,
      removeItem: secureRemove,
    };

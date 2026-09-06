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
 * numbered chunks; the `.count` key records how many there are.
 *
 * SecureStore only accepts keys made of alphanumerics, ".", "-" and "_" — a
 * ":" separator throws "Invalid key provided to SecureStore" on every call,
 * which silently breaks session persistence — so the chunk suffix uses ".".
 */

const MAX_CHUNK = 1800;

const countKey = (name: string) => `${name}.count`;
const chunkKey = (name: string, i: number) => `${name}.${i}`;

async function secureGet(name: string): Promise<string | null> {
  const count = Number((await SecureStore.getItemAsync(countKey(name))) ?? 0);
  if (!count) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(name, i));
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function secureSet(name: string, value: string): Promise<void> {
  await secureRemove(name);
  const chunks = Math.ceil(value.length / MAX_CHUNK);
  for (let i = 0; i < chunks; i += 1) {
    await SecureStore.setItemAsync(chunkKey(name, i), value.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK));
  }
  await SecureStore.setItemAsync(countKey(name), String(chunks));
}

async function secureRemove(name: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(countKey(name))) ?? 0);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(name, i));
  }
  await SecureStore.deleteItemAsync(countKey(name));
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
  try {
    await secureSet(name, legacy);
    await AsyncStorage.removeItem(name);
  } catch {
    // Keychain write refused — keep the legacy copy in place and stay signed in
    // rather than losing the session to a failed upgrade.
  }
  return legacy;
}

export const sessionStorage = Platform.OS === "web"
  ? AsyncStorage
  : {
      getItem: secureGetWithMigration,
      setItem: secureSet,
      removeItem: secureRemove,
    };

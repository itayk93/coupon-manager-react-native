import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidHexHash(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value);
}

export async function checkWerkzeugPasswordHash(storedHash: string, password: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;

  const [methodSpec, salt, expectedHash] = parts;
  if (!methodSpec || !salt || !isValidHexHash(expectedHash)) return false;

  const methodParts = methodSpec.split(":");
  const method = methodParts[0];
  const passwordBytes = utf8ToBytes(password);
  const saltBytes = utf8ToBytes(salt);

  if (method === "pbkdf2") {
    const digestName = methodParts[1] || "sha256";
    const iterations = Number(methodParts[2] || 1000000);
    if (!isPositiveInteger(iterations)) return false;
    if (digestName !== "sha256" && digestName !== "sha512") return false;

    const digest = digestName === "sha512" ? sha512 : sha256;
    const derived = await pbkdf2Async(digest, passwordBytes, saltBytes, {
      c: iterations,
      dkLen: expectedHash.length / 2,
    });
    return timingSafeEqual(toHex(derived), expectedHash);
  }

  if (method === "scrypt") {
    const n = Number(methodParts[1] || 32768);
    const r = Number(methodParts[2] || 8);
    const p = Number(methodParts[3] || 1);
    if (!isPositiveInteger(n) || !isPositiveInteger(r) || !isPositiveInteger(p)) return false;

    const derived = await scryptAsync(passwordBytes, saltBytes, {
      N: n,
      r,
      p,
      dkLen: expectedHash.length / 2,
    });
    return timingSafeEqual(toHex(derived), expectedHash);
  }

  return false;
}

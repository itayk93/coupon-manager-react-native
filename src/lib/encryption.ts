import CryptoJS from "crypto-js";

// Safe extraction of constants in both Expo and standard Node/Vite environments
let extraConfig: Record<string, any> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require("expo-constants")?.default || require("expo-constants");
  extraConfig = Constants?.expoConfig?.extra || {};
} catch {
  // In pure Node or vitest runtime without expo-constants
  extraConfig = {};
}

export const ENCRYPTION_KEY =
  extraConfig?.encryptionKey ||
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_ENCRYPTION_KEY) ||
  "iKWLJAq-F_BoMip2duhM3-QUPNtxRrefQ0TeaxXQc0E=";

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  
  if (typeof atob === "function") {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const parsed = CryptoJS.enc.Base64.parse(base64);
  return wordArrayToBytes(parsed);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binaryString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  
  let base64 = "";
  if (typeof btoa === "function") {
    base64 = btoa(binaryString);
  } else {
    const words = bytesToWordArray(bytes);
    base64 = CryptoJS.enc.Base64.stringify(words);
  }
  
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const bytes = new Uint8Array(wordArray.sigBytes);
  for (let i = 0; i < wordArray.sigBytes; i += 1) {
    bytes[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}

/**
 * Hermes has no global WebCrypto, so `CryptoJS.lib.WordArray.random()` throws
 * "Native crypto module could not be used to get secure random number." on
 * device. Prefer expo-crypto there, and fall back to WebCrypto on web/node.
 */
function randomBytes(length: number): Uint8Array {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoCrypto = require("expo-crypto");
    if (typeof ExpoCrypto?.getRandomBytes === "function") {
      return Uint8Array.from(ExpoCrypto.getRandomBytes(length));
    }
  } catch {
    // expo-crypto is unavailable in plain Node/vitest runtimes
  }

  const webCrypto = (globalThis as any)?.crypto;
  if (typeof webCrypto?.getRandomValues === "function") {
    return webCrypto.getRandomValues(new Uint8Array(length));
  }

  throw new Error("No secure random source available");
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return typeof value === "string" && value.startsWith("gAAAAA");
}

export async function decrypt(ciphertext: string | null | undefined): Promise<string> {
  if (!ciphertext) return "";
  if (!isEncrypted(ciphertext)) {
    return ciphertext;
  }

  try {
    const keyBytes = base64UrlDecode(ENCRYPTION_KEY);
    if (keyBytes.length !== 32) {
      throw new Error("Invalid Fernet key size");
    }

    const signingKey = keyBytes.slice(0, 16);
    const encryptionKey = keyBytes.slice(16, 32);
    const decoded = base64UrlDecode(ciphertext);

    if (decoded.length < 9 + 16 + 32) {
      throw new Error("Ciphertext too short");
    }

    if (decoded[0] !== 0x80) {
      throw new Error("Unknown Fernet version");
    }

    const iv = decoded.slice(9, 25);
    const ciphertextBytes = decoded.slice(25, decoded.length - 32);
    const hmacBytes = decoded.slice(decoded.length - 32);
    const dataToVerify = decoded.slice(0, decoded.length - 32);

    const expectedMac = CryptoJS.HmacSHA256(
      bytesToWordArray(dataToVerify),
      bytesToWordArray(signingKey)
    );
    
    if (!constantTimeEqual(wordArrayToBytes(expectedMac), hmacBytes)) {
      throw new Error("Fernet HMAC verification failed");
    }

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: bytesToWordArray(ciphertextBytes) } as CryptoJS.lib.CipherParams,
      bytesToWordArray(encryptionKey),
      {
        iv: bytesToWordArray(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    const result = CryptoJS.enc.Utf8.stringify(decrypted);
    return result || ciphertext;
  } catch (error) {
    console.error("Decryption error:", error);
    return ciphertext;
  }
}

export async function encrypt(plaintext: string | null | undefined): Promise<string> {
  if (!plaintext) return "";
  if (isEncrypted(plaintext)) return plaintext;

  try {
    const keyBytes = base64UrlDecode(ENCRYPTION_KEY);
    if (keyBytes.length !== 32) {
      throw new Error("Invalid Fernet key size");
    }

    const signingKey = keyBytes.slice(0, 16);
    const encryptionKey = keyBytes.slice(16, 32);

    // 1. Version (0x80)
    const version = new Uint8Array([0x80]);

    // 2. Timestamp (8 bytes big-endian)
    const timestampBytes = new Uint8Array(8);
    const nowSecs = Math.floor(Date.now() / 1000);
    const view = new DataView(timestampBytes.buffer);
    view.setBigUint64(0, BigInt(nowSecs), false);

    // 3. IV (16 random bytes)
    const iv = randomBytes(16);

    // 4. Encrypt AES-128-CBC with PKCS7 padding
    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(plaintext),
      bytesToWordArray(encryptionKey),
      {
        iv: bytesToWordArray(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    const ciphertextBytes = wordArrayToBytes(encrypted.ciphertext);

    // 5. Data to sign: Version || Timestamp || IV || Ciphertext
    const dataToSign = new Uint8Array(
      version.length + timestampBytes.length + iv.length + ciphertextBytes.length
    );
    let offset = 0;
    dataToSign.set(version, offset);
    offset += version.length;
    dataToSign.set(timestampBytes, offset);
    offset += timestampBytes.length;
    dataToSign.set(iv, offset);
    offset += iv.length;
    dataToSign.set(ciphertextBytes, offset);

    // 6. HMAC-SHA256
    const hmacWordArray = CryptoJS.HmacSHA256(
      bytesToWordArray(dataToSign),
      bytesToWordArray(signingKey)
    );
    const hmacBytes = wordArrayToBytes(hmacWordArray);

    // 7. Combine all: dataToSign || hmacBytes
    const finalToken = new Uint8Array(dataToSign.length + hmacBytes.length);
    finalToken.set(dataToSign, 0);
    finalToken.set(hmacBytes, dataToSign.length);

    // 8. Base64 URL safe encode
    return base64UrlEncode(finalToken);
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
}

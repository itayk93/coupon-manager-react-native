// Fernet implementation in TypeScript using Web Crypto API
import CryptoJS from "crypto-js";

export const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || "REDACTED_ENCRYPTION_KEY=";

function base64UrlDecode(str: string): Uint8Array {
  // Convert URL-safe base64 to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '='
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryString = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binaryString);
  // Convert to URL-safe base64
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToWordArray(bytes: Uint8Array) {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray) {
  const bytes = new Uint8Array(wordArray.sigBytes);
  for (let i = 0; i < wordArray.sigBytes; i += 1) {
    bytes[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function decryptWithCryptoJs(ciphertext: string): string {
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

  const expectedMac = CryptoJS.HmacSHA256(bytesToWordArray(dataToVerify), bytesToWordArray(signingKey));
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

  return CryptoJS.enc.Utf8.stringify(decrypted);
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  return value.startsWith('gAAAAA');
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!isEncrypted(ciphertext)) {
    return ciphertext; // Not encrypted, return as is
  }

  try {
    if (!globalThis.crypto?.subtle) {
      return decryptWithCryptoJs(ciphertext);
    }

    const keyBytes = base64UrlDecode(ENCRYPTION_KEY);
    if (keyBytes.length !== 32) {
      throw new Error("Invalid Fernet key size");
    }

    const signingKey = keyBytes.slice(0, 16);
    const encryptionKey = keyBytes.slice(16, 32);

    const decoded = base64UrlDecode(ciphertext);
    if (decoded.length < 9 + 16 + 32) { // min length: version(1) + timestamp(8) + iv(16) + hmac(32)
      throw new Error("Ciphertext too short");
    }

    const version = decoded[0];
    if (version !== 0x80) {
      throw new Error("Unknown Fernet version");
    }

    // Parse the token
    const timestampBytes = decoded.slice(1, 9);
    const iv = decoded.slice(9, 25);
    const ciphertextBytes = decoded.slice(25, decoded.length - 32);
    const hmacBytes = decoded.slice(decoded.length - 32);
    
    // Verify HMAC
    const cryptoKeyForMac = await crypto.subtle.importKey(
      "raw",
      signingKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const dataToVerify = decoded.slice(0, decoded.length - 32);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKeyForMac,
      hmacBytes,
      dataToVerify
    );

    if (!isValid) {
      throw new Error("Fernet HMAC verification failed");
    }

    // Decrypt AES-128-CBC
    const cryptoKeyForDecryption = await crypto.subtle.importKey(
      "raw",
      encryptionKey,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKeyForDecryption,
      ciphertextBytes
    );

    const textDecoder = new TextDecoder();
    return textDecoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    // Returning original ciphertext or throwing error depending on usecase
    // For this app, it's better to return original if decryption fails gracefully 
    // or maybe throw to prevent showing encrypted junk
    throw error;
  }
}

export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // Already encrypted

  try {
    const keyBytes = base64UrlDecode(ENCRYPTION_KEY);
    if (keyBytes.length !== 32) {
      throw new Error("Invalid Fernet key size");
    }

    const signingKey = keyBytes.slice(0, 16);
    const encryptionKey = keyBytes.slice(16, 32);

    // 1. Version
    const version = new Uint8Array([0x80]);

    // 2. Timestamp (8 bytes big-endian)
    const timestampBytes = new Uint8Array(8);
    const nowSecs = Math.floor(Date.now() / 1000);
    const view = new DataView(timestampBytes.buffer);
    // Using DataView to write 64-bit int properly (setBigInt64)
    view.setBigUint64(0, BigInt(nowSecs), false); // false = big endian

    // 3. IV
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // 4. Encrypt AES-128-CBC
    const cryptoKeyForEncryption = await crypto.subtle.importKey(
      "raw",
      encryptionKey,
      { name: "AES-CBC" },
      false,
      ["encrypt"]
    );

    const textEncoder = new TextEncoder();
    const encodedPlaintext = textEncoder.encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKeyForEncryption,
      encodedPlaintext
    );
    const ciphertextBytes = new Uint8Array(ciphertextBuffer);

    // 5. Construct token (without HMAC)
    const dataToSign = new Uint8Array(version.length + timestampBytes.length + iv.length + ciphertextBytes.length);
    let offset = 0;
    dataToSign.set(version, offset); offset += version.length;
    dataToSign.set(timestampBytes, offset); offset += timestampBytes.length;
    dataToSign.set(iv, offset); offset += iv.length;
    dataToSign.set(ciphertextBytes, offset);

    // 6. HMAC-SHA256
    const cryptoKeyForMac = await crypto.subtle.importKey(
      "raw",
      signingKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const hmacBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKeyForMac,
      dataToSign
    );
    const hmacBytes = new Uint8Array(hmacBuffer);

    // 7. Combine all
    const finalToken = new Uint8Array(dataToSign.length + hmacBytes.length);
    finalToken.set(dataToSign, 0);
    finalToken.set(hmacBytes, dataToSign.length);

    // 8. Base64 encode
    return base64UrlEncode(finalToken.buffer);
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
}

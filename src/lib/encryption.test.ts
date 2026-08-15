import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "./encryption";

describe("Fernet Encryption & Decryption", () => {
  it("should detect encrypted tokens", () => {
    expect(isEncrypted("gAAAAABm...")).toBe(true);
    expect(isEncrypted("123456")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("should encrypt and decrypt a plaintext string correctly", async () => {
    const originalText = "COUPON-SECRET-12345-תודה";
    const encrypted = await encrypt(originalText);
    
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toBe(originalText);

    const decrypted = await decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it("should return plaintext if string is not encrypted", async () => {
    const rawCode = "NORMAL_CODE";
    const result = await decrypt(rawCode);
    expect(result).toBe(rawCode);
  });
});

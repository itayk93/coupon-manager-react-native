import { describe, expect, it } from "vitest";
import {
  INSTALL_SNOOZE_MS,
  isInstallPromptSnoozed,
  markInstalled,
  snoozeInstallPrompt,
} from "./installPromptState";

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

const NOW = 1_800_000_000_000;

describe("install prompt snoozing", () => {
  it("asks a first-time visitor", () => {
    expect(isInstallPromptSnoozed(NOW, fakeStore())).toBe(false);
  });

  it("stays quiet for a week after a dismissal", () => {
    const store = fakeStore();
    snoozeInstallPrompt(NOW, store);
    expect(isInstallPromptSnoozed(NOW + 1000, store)).toBe(true);
    expect(isInstallPromptSnoozed(NOW + INSTALL_SNOOZE_MS - 1, store)).toBe(true);
  });

  it("asks again once the week is up", () => {
    const store = fakeStore();
    snoozeInstallPrompt(NOW, store);
    expect(isInstallPromptSnoozed(NOW + INSTALL_SNOOZE_MS, store)).toBe(false);
  });

  it("never asks again once the app was installed", () => {
    const store = fakeStore();
    markInstalled(store);
    expect(isInstallPromptSnoozed(NOW + INSTALL_SNOOZE_MS * 100, store)).toBe(true);
  });

  it("treats a clock that jumped backwards as still snoozed", () => {
    const store = fakeStore();
    snoozeInstallPrompt(NOW, store);
    expect(isInstallPromptSnoozed(NOW - 60_000, store)).toBe(true);
  });

  it("asks rather than hides when storage is unavailable or corrupt", () => {
    expect(isInstallPromptSnoozed(NOW, null)).toBe(false);
    expect(isInstallPromptSnoozed(NOW, fakeStore({ "pwa_install:snoozed_at": "soon" }))).toBe(false);
  });

  it("does not throw when storage refuses to write", () => {
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => snoozeInstallPrompt(NOW, readOnly)).not.toThrow();
    expect(() => markInstalled(readOnly)).not.toThrow();
  });
});

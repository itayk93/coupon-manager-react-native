import { afterEach, describe, expect, it, vi } from "vitest";

function sessionStorageStub() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("pending auth destination", () => {
  it("survives a web reload and is consumed once", async () => {
    const sessionStorage = sessionStorageStub();
    vi.stubGlobal("window", { sessionStorage });

    const firstLoad = await import("./pendingRoute");
    firstLoad.rememberPendingRoute("/coupons/coupon-public-id");

    vi.resetModules();
    const afterOAuthRedirect = await import("./pendingRoute");
    expect(afterOAuthRedirect.takePendingRoute()).toBe("/coupons/coupon-public-id");
    expect(afterOAuthRedirect.takePendingRoute()).toBeNull();
  });

  it("does not persist auth routes that would loop", async () => {
    const sessionStorage = sessionStorageStub();
    vi.stubGlobal("window", { sessionStorage });

    const routes = await import("./pendingRoute");
    routes.rememberPendingRoute("/(auth)/login");
    expect(routes.takePendingRoute()).toBeNull();
  });
});

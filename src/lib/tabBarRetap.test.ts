import { describe, expect, it, vi } from "vitest";
import { emitTabRetap, onTabRetap } from "./tabBarRetap";

describe("tabBarRetap", () => {
  it("delivers an emit to the subscriber of the same path", () => {
    const handler = vi.fn();
    const off = onTabRetap("/coupons", handler);
    emitTabRetap("/coupons");
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("does not leak a re-tap into a different tab", () => {
    const handler = vi.fn();
    const off = onTabRetap("/coupons", handler);
    emitTabRetap("/");
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const off = onTabRetap("/", handler);
    off();
    emitTabRetap("/");
    expect(handler).not.toHaveBeenCalled();
  });

  it("fans out to several subscribers of the same tab", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onTabRetap("/", a);
    const offB = onTabRetap("/", b);
    emitTabRetap("/");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });
});

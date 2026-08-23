import { describe, expect, it } from "vitest";
import {
  isHiddenLedgerRow,
  ledgerAmountFromTransaction,
  ledgerAmountFromUsage,
  usedValueFromLedger,
} from "./couponLedger";

describe("usedValueFromLedger", () => {
  it("uses the balance when the ledger carries its own loading row", () => {
    // The GoodPharm coupon: loaded 100, spent 33 + 37.80 + 17.90.
    const amounts = [
      ledgerAmountFromTransaction(null, -100),
      ledgerAmountFromTransaction(null, 33),
      ledgerAmountFromTransaction(null, 37.8),
      ledgerAmountFromTransaction(null, 17.9),
    ];
    expect(usedValueFromLedger(100, amounts)).toBeCloseTo(88.7, 2);
  });

  it("reads a loading stored in either column the same way", () => {
    expect(ledgerAmountFromTransaction(100, null)).toBe(100);
    expect(ledgerAmountFromTransaction(null, -100)).toBe(100);
  });

  it("treats a usage-only ledger as spending against the coupon value", () => {
    const amounts = [ledgerAmountFromUsage(30), ledgerAmountFromUsage(-10)];
    expect(usedValueFromLedger(100, amounts)).toBe(40);
  });

  it("does not double count a loading row as spending", () => {
    const amounts = [ledgerAmountFromTransaction(100, 0), ledgerAmountFromUsage(88.7)];
    expect(usedValueFromLedger(100, amounts)).toBeCloseTo(88.7, 2);
  });

  it("clamps to the coupon value in both directions", () => {
    expect(usedValueFromLedger(100, [ledgerAmountFromUsage(250)])).toBe(100);
    expect(usedValueFromLedger(100, [ledgerAmountFromTransaction(400, 0)])).toBe(0);
    expect(usedValueFromLedger(100, [])).toBe(0);
  });
});

describe("isHiddenLedgerRow", () => {
  it("flags the duplicated Multipass audit rows", () => {
    expect(isHiddenLedgerRow("עדכון אוטומטי via Multipass daily flow")).toBe(true);
    expect(isHiddenLedgerRow("Updated by MULTIPASS DAILY FLOW")).toBe(true);
  });

  it("keeps real rows", () => {
    expect(isHiddenLedgerRow("גוד פארם - גבעתיים")).toBe(false);
    expect(isHiddenLedgerRow("")).toBe(false);
  });

  it("counts a mirrored usage only once, as the history shows it", () => {
    // coupon 753: the 17.90 exists as a transaction row and again as a hidden
    // audit row. Counting both pushed used_value to the full 100.
    const amounts = [
      ledgerAmountFromTransaction(100, null),
      ledgerAmountFromTransaction(null, 33),
      ledgerAmountFromTransaction(null, 37.8),
      ledgerAmountFromTransaction(0, 17.9),
    ];
    expect(usedValueFromLedger(100, amounts)).toBeCloseTo(88.7, 2);
  });
});

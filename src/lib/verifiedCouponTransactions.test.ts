import { describe, it, expect } from "vitest";
import { withoutVerifiedMirrors } from "./verifiedCouponTransactions";
import { withLedgerBalances } from "./couponLedgerBalances";
import { spendEvents } from "./couponSavings";
const mirror = { id:1758, coupon_id:600, source:"Multipass", reference_number:"max_ref_1762116515_1", transaction_date:"2025-07-03T10:21:00", usage_amount:12, recharge_amount:0, location:"Arcafe" };
const canonical = {...mirror,id:1763,source:"BuyMe",reference_number:"buyme_ref_610a5d4f5f730040"};
describe("verified provider mirrors",()=>{
 it("projects a verified pair once without mutating originals",()=>{const rows=[mirror,canonical];expect(withoutVerifiedMirrors(rows)).toEqual([canonical]);expect(rows).toEqual([mirror,canonical]);});
 it("keeps the mirror if the canonical original is absent",()=>expect(withoutVerifiedMirrors([mirror])).toEqual([mirror]));
 it("never deduplicates equal amounts by heuristic",()=>{const changed={...mirror,id:9999};expect(withoutVerifiedMirrors([changed,canonical])).toHaveLength(2);});
 it.each(["coupon_id","source","reference_number","transaction_date","usage_amount","recharge_amount"])("requires exact original %s",key=>{const changed={...mirror,[key]:key==="coupon_id"?601:key==="usage_amount"?13:key==="recharge_amount"?1:"changed"};expect(withoutVerifiedMirrors([changed,canonical] as any)).toHaveLength(2);});
 it("keeps manual and other coupon records",()=>expect(withoutVerifiedMirrors([{...mirror,source:"User"},{...mirror,coupon_id:601},canonical])).toHaveLength(3));
 it("uses the same projection for wallet and dated savings",()=>{const coupon={id:600,value:400,used_value:400,ledger_used_value:400,date_added:"2025-04-09",cost:200};const tx=[mirror,canonical];expect((withLedgerBalances([coupon] as any,[],tx)[0] as any).ledger_used_value).toBe(400);const events=spendEvents(coupon,[],tx);expect(events.filter(e=>e.at===Date.parse(mirror.transaction_date))).toEqual([{at:Date.parse(mirror.transaction_date),amount:12}]);});
});

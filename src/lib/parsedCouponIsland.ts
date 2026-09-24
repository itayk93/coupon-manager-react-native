import type { ParsedCoupon } from "@/hooks/useCouponAI";
import { formatDateShort } from "@/lib/formatDate";
import { formatIls, formatIlsCompact } from "@/lib/formatIls";

export type IslandCopy = { title: string; message?: string };

/** Whole amounts read better without agorot; a 199.90 voucher keeps them. */
function amount(value: number): string {
  return Number.isInteger(value) ? formatIlsCompact(value) : formatIls(value);
}

/** "₪ 200 · בתוקף עד 12/03/2027", or whatever part of it the parser found. */
function details(coupon: ParsedCoupon): string | undefined {
  const parts: string[] = [];
  if (typeof coupon.value === "number" && Number.isFinite(coupon.value) && coupon.value > 0) {
    parts.push(amount(coupon.value));
  }
  const expiry = formatDateShort(coupon.expiration);
  if (expiry) parts.push(`בתוקף עד ${expiry}`);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * What the island says when the smart parser hands a coupon to the add form.
 *
 * The form opens already filled in, and the island is the one line that tells
 * the user why: this is what was read off their text or photo, so check it
 * before saving. Only the first coupon is opened, so when the parser found
 * several (`found`) the island says so rather than letting the rest vanish
 * silently.
 */
export function parsedCouponIsland(first: ParsedCoupon, found = 1): IslandCopy {
  const company = first.company?.trim();

  if (found > 1) {
    const opened = [company, details(first)].filter(Boolean).join(" · ");
    return {
      title: `זיהינו ${found} קופונים`,
      message: opened ? `פתחנו את הראשון: ${opened}` : "פתחנו את הראשון לבדיקה",
    };
  }

  return {
    title: company ? `זיהינו קופון של ${company}` : "זיהינו קופון",
    message: details(first) ?? "בדקו את הפרטים ושמרו",
  };
}

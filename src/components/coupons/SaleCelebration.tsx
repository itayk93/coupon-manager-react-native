import React from "react";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";

/** The "you sold a coupon" moment. Shape and timing live in the overlay, so
 *  selling and finishing a coupon read as the same kind of event. */
export function SaleCelebration({
  title = "מכרת קופון!",
  subtitle = "נרשם אצלך בקופונים שמכרתי",
  onDone,
}: {
  title?: string;
  subtitle?: string;
  onDone: () => void;
}) {
  return <CelebrationOverlay title={title} subtitle={subtitle} onDone={onDone} />;
}

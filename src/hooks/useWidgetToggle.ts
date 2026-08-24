import { useCoupons, useUpdateCoupon, type DecryptedCoupon } from "@/hooks/useCoupons";
import { notify } from "@/lib/notify";
import {
  MAX_WIDGET_COUPONS,
  isInWidget,
  isWidgetEligible,
  isWidgetFull,
  nextWidgetOrder,
} from "@/lib/widgetSelection";

/**
 * Putting one coupon on the home-screen widget, from wherever the user is.
 *
 * Capacity is read from the whole wallet rather than from this coupon, so the
 * detail page and the quick-view modal refuse to add a fifth coupon for the
 * same reason the widget settings screen greys its rows out.
 */
export function useWidgetToggle(coupon: DecryptedCoupon | null | undefined) {
  const { data: allCoupons = [] } = useCoupons();
  const updateCoupon = useUpdateCoupon();

  const inWidget = coupon ? isInWidget(coupon) : false;
  const isFull = isWidgetFull(allCoupons);
  // An ineligible coupon is still removable: it may have been added while it
  // still had a balance.
  const canToggle = coupon ? isWidgetEligible(coupon) || inWidget : false;

  const toggle = () => {
    if (!coupon) return;

    if (inWidget) {
      updateCoupon.mutate({
        id: coupon.id,
        updates: { show_in_widget: false, widget_display_order: null },
      });
      notify.success("הקופון הוסר מהווידג'ט");
      return;
    }

    if (!canToggle) {
      notify.error("קופון זה אינו זמין להצגה בווידג'ט");
      return;
    }

    if (isFull) {
      notify.error(`ניתן לבחור עד ${MAX_WIDGET_COUPONS} קופונים בווידג'ט`);
      return;
    }

    updateCoupon.mutate({
      id: coupon.id,
      updates: { show_in_widget: true, widget_display_order: nextWidgetOrder(allCoupons) },
    });
    notify.success("הקופון נוסף לווידג'ט");
  };

  return {
    inWidget,
    isFull,
    canToggle,
    /** True when the button should be visible but inert. */
    disabled: !inWidget && isFull,
    maxCoupons: MAX_WIDGET_COUPONS,
    toggle,
  };
}
